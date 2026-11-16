import type {
  LightingMode,
  LightingView,
  Workspace,
  WorldDocument,
} from "../../../shared/document";
import type { Block } from "../../../shared/document";
import type { LightField, LightingRuntime } from "../../../shared/light";
import { combineLight, daylightAt } from "../lib/daylight";
import {
  COUNT,
  boundsOfCells,
  boundsVolume,
  padBounds,
  snapshotGrid,
  unionBounds,
  type Bounds,
} from "../lib/grid";
import { sampleField } from "../lib/sample";
import { LightingJob } from "../lib/solve";

/** Radius re-solved around an edit in local mode. */
export const LOCAL_PAD = 6;
/** Above this share of the volume, a global solve is cheaper and exact. */
const ESCALATE_AT = 0.5;
/** Solver milliseconds per animation frame. */
const DEFAULT_BUDGET_MS = 3;
/** Heap pops per inner slice before re-checking the clock. */
const SLICE = 1500;
/**
 * While blocks are still being placed every frame, restarting the solve each
 * frame would throw away all the work. Requiring a couple of quiet frames lets
 * continuous building keep its frame budget, then catches up once the edit
 * stream pauses. Counted in frames rather than milliseconds so the behaviour is
 * deterministic for tests and independent of display refresh rate.
 */
const QUIET_FRAMES_BEFORE_SOLVE = 2;

const runtimes = new WeakMap<Workspace, LightingRuntime>();

export function createLightingRuntime(s: Workspace): LightingRuntime {
  const runtime = new LightingRuntimeImpl(s);
  runtimes.set(s, runtime);
  return runtime;
}

export function lightingFor(s: Workspace): LightingRuntime {
  const runtime = runtimes.get(s);
  if (!runtime) throw Error("光照系统尚未初始化");
  return runtime;
}

export function initialLightingView(): LightingView {
  return {
    status: "idle",
    mode: "local",
    level: 1,
    sky: 1,
    torch: 0,
    exposure: "unknown",
    approximate: false,
    pending: false,
    torches: 0,
    enclosed: 0,
    visited: 0,
    elapsed: 0,
    discarded: 0,
    fieldRevision: -1,
    daylight: 1,
  };
}

class LightingRuntimeImpl implements LightingRuntime {
  private applied: LightField | null = null;
  private appliedVersion = 0;
  private job: LightingJob | null = null;
  private jobRevision = -1;
  private jobBounds: Bounds | null = null;
  private jobApproximate = false;
  private jobElapsed = 0;
  /** Bounds accumulated since the applied field's revision. */
  private queued: Bounds | null = null;
  private queuedFull = false;
  private discarded = 0;
  private mode: LightingMode = "local";
  /** Newest document revision already accounted for. */
  private knownRevision = -1;
  /** Frames since the last edit, used to defer solves during rapid building. */
  private quietFrames = QUIET_FRAMES_BEFORE_SOLVE;

  constructor(private readonly s: Workspace) {
    this.mode = s.lighting.mode;
  }

  get field() {
    return this.applied;
  }

  get version() {
    return this.appliedVersion;
  }

  markChanged(cells: Block[]) {
    // Edits bump the revision synchronously, so this state has been accounted
    // for; tick must not mistake it for an unannounced document swap.
    this.knownRevision = this.s.doc.revision;
    this.quietFrames = 0;
    if (!cells.length) return;
    if (this.mode === "full") {
      this.queuedFull = true;
      this.queued = null;
      return;
    }
    const box = boundsOfCells(cells);
    if (!box) return;
    const padded = padBounds(box, LOCAL_PAD);
    // A huge region edit is better served by one exact global solve, which is
    // also the cheaper choice at this size.
    if (boundsVolume(padded) > COUNT * ESCALATE_AT) {
      this.queuedFull = true;
      this.queued = null;
      return;
    }
    this.queued = unionBounds(this.queued, padded);
  }

  invalidate() {
    this.queuedFull = true;
    this.queued = null;
    this.job?.discard();
    this.job = null;
    this.applied = null;
    this.appliedVersion++;
    this.knownRevision = -1;
  }

  setMode(mode: LightingMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.s.lighting.mode = mode;
    // Settle an approximation rather than leaving a stale local result visible.
    // An already-exact field needs no extra work.
    if (mode === "full" && this.applied?.approximate) {
      this.queuedFull = true;
      this.queued = null;
    }
  }

  /** True while the in-flight job was built from an older document revision. */
  private get stale() {
    return !!this.job && this.jobRevision !== this.s.doc.revision;
  }

  tick(doc: WorldDocument, budgetMs = DEFAULT_BUDGET_MS) {
    // A document swapped in without markChanged (load/import/direct mutation)
    // still has to be picked up. Revisions are compared rather than trusting
    // call order, so switching modes or loading can never silently keep an
    // old field.
    if (this.knownRevision < 0) {
      this.knownRevision = doc.revision;
      if (this.applied?.revision !== doc.revision) this.queuedFull = true;
    } else if (doc.revision !== this.knownRevision) {
      this.knownRevision = doc.revision;
      this.queuedFull = true;
      this.queued = null;
    }

    if (this.job && this.stale) {
      // The world moved on while this solve ran. Drop it before it can apply:
      // showing it would resurrect a torch that has since been removed.
      this.job.discard();
      this.job = null;
      this.discarded++;
      if (this.jobApproximate)
        this.queued = unionBounds(this.queued, this.jobBounds);
      else this.queuedFull = true;
    }

    this.quietFrames = Math.min(
      QUIET_FRAMES_BEFORE_SOLVE,
      this.quietFrames + 1,
    );
    if (!this.job && this.quietFrames >= QUIET_FRAMES_BEFORE_SOLVE) {
      if (this.queuedFull) this.startJob(doc, null);
      else if (this.queued) this.startJob(doc, this.queued);
    }

    if (this.job) {
      const started = clock();
      while (!this.job.done && clock() - started < budgetMs)
        this.job.step(SLICE);
      this.jobElapsed += clock() - started;
      if (this.job.done) this.finishJob(doc);
    }

    this.publish(doc);
  }

  private startJob(doc: WorldDocument, bounds: Bounds | null) {
    const snapshot = snapshotGrid(doc);
    // A local solve carries the previous field over. Without one there is
    // nothing to carry, so fall back to an exact global solve instead of
    // leaving everything outside the window black.
    const window = this.applied ? bounds : null;
    this.job = new LightingJob(
      snapshot.trans,
      snapshot.torchCells,
      window,
      this.applied,
    );
    this.jobRevision = snapshot.revision;
    this.jobBounds = window;
    this.jobApproximate = window !== null;
    this.jobElapsed = 0;
    this.queued = null;
    this.queuedFull = false;
  }

  private finishJob(doc: WorldDocument) {
    const job = this.job!;
    const elapsed = this.jobElapsed;
    this.job = null;
    if (this.jobRevision !== doc.revision) {
      // A late result for a world state that no longer exists: discard it and
      // re-queue the same footprint against the current revision.
      this.discarded++;
      if (this.jobApproximate)
        this.queued = unionBounds(this.queued, this.jobBounds);
      else this.queuedFull = true;
      return;
    }
    const result = job.result();
    this.applied = {
      sky: result.sky,
      torch: result.torch,
      revision: doc.revision,
      approximate: this.jobApproximate,
      visited: result.visited,
      torches: job.torchTotal,
      enclosed: result.enclosed,
      elapsed,
    };
    this.appliedVersion++;
  }

  /**
   * Exact, synchronous rebuild. Used right after creating/loading a world so
   * the first frame is already correct; routine edits stay incremental.
   */
  rebuildNow() {
    const doc = this.s.doc;
    this.job?.discard();
    this.job = null;
    this.queued = null;
    this.queuedFull = false;
    const snapshot = snapshotGrid(doc);
    const job = new LightingJob(snapshot.trans, snapshot.torchCells, null, null);
    const started = clock();
    while (!job.step(4000)) {
      // 20 480 cells; bounded to a handful of slices.
    }
    const result = job.result();
    this.applied = {
      sky: result.sky,
      torch: result.torch,
      revision: doc.revision,
      approximate: false,
      visited: result.visited,
      torches: job.torchTotal,
      enclosed: result.enclosed,
      elapsed: clock() - started,
    };
    this.appliedVersion++;
    this.jobRevision = doc.revision;
    this.knownRevision = doc.revision;
    this.publish(doc);
  }

  /**
   * Publish the reactive readout. Values are rounded so Vue's change detection
   * ignores sub-percent flicker; the shader reads the float fields directly.
   */
  private publish(doc: WorldDocument) {
    const view = this.s.lighting;
    const daylight = daylightAt(doc.time);
    const eyeY = doc.player.y + 1.55;
    const sky = this.applied
      ? sampleField(this.applied.sky, doc.player.x, eyeY, doc.player.z)
      : 1;
    const torch = this.applied
      ? sampleField(this.applied.torch, doc.player.x, eyeY, doc.player.z)
      : 0;
    const level = combineLight(sky, torch, daylight);
    view.mode = this.mode;
    view.daylight = round3(daylight);
    view.sky = round3(sky);
    view.torch = round3(torch);
    view.level = round3(level);
    view.exposure = classify(sky, torch, level);
    view.status = this.job ? "computing" : this.applied ? "ready" : "idle";
    view.approximate = this.applied?.approximate ?? false;
    view.pending = !!this.job || !!this.queued || this.queuedFull;
    view.torches = this.applied?.torches ?? 0;
    view.enclosed = this.applied?.enclosed ?? 0;
    view.visited = this.job ? this.job.visited : (this.applied?.visited ?? 0);
    view.elapsed = round3(
      this.job ? this.jobElapsed : (this.applied?.elapsed ?? 0),
    );
    view.discarded = this.discarded;
    view.fieldRevision = this.applied?.revision ?? -1;
  }
}

/**
 * Classifies the character's situation from the raw field, not from the
 * blended level, so "indoors at noon" is not mistaken for "outdoors".
 */
function classify(
  sky: number,
  torch: number,
  level: number,
): LightingView["exposure"] {
  if (sky >= 0.85) return "open";
  if (torch >= 0.15) return "torchlit";
  if (level < 0.09) return "dark";
  if (sky >= 0.12) return "sheltered";
  return level >= 0.09 ? "sheltered" : "dark";
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const clock = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();
