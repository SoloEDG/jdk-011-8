import { D, H, SX, SY, SZ, W, type Bounds } from "./grid";
import {
  countEnclosed,
  createFlood,
  CUTOFF,
  SKY_ATTENUATION,
  SKY_UP_ATTENUATION,
  TORCH_ATTENUATION,
  type FloodJob,
  type IncomingSeed,
} from "./solver";

export interface SolverResult {
  sky: Float32Array;
  torch: Float32Array;
  /** Heap expansions; surfaced as the cost of the update. */
  visited: number;
  /** Non-solid, non-torch cells with no sky access after this solve. */
  enclosed: number;
}

/**
 * A resumable two-stage solve (sky, then torches). All work happens inside
 * `step`, so a scheduler can give it an op budget per animation frame and large
 * lighting updates never block continuous building.
 *
 * `bounds === null` rebuilds the field from zero — the reference result.
 * With bounds, only that window is cleared and re-flooded. Light entering the
 * window from its surroundings is re-injected as boundary seeds, so local
 * solving does not invent a false shadow ring at the window edge.
 */
export class LightingJob {
  readonly sky: Float32Array;
  readonly torch: Float32Array;
  private stage: 0 | 1 | 2 = 0;
  private current: FloodJob | null = null;
  private abandoned = false;
  private total = 0;
  private readonly torchCount: number;
  /** Sky boundary seeds captured before the window is cleared. */
  private readonly skyIncoming: IncomingSeed[] | null;
  /** Torch boundary seeds captured before the window is cleared. */
  private readonly torchIncoming: IncomingSeed[] | null;

  constructor(
    private readonly trans: Float32Array,
    private readonly torchCells: Int32Array,
    private readonly bounds: Bounds | null,
    previous: { sky: Float32Array; torch: Float32Array } | null,
  ) {
    this.sky = previous
      ? new Float32Array(previous.sky)
      : new Float32Array(trans.length);
    this.torch = previous
      ? new Float32Array(previous.torch)
      : new Float32Array(trans.length);
    this.torchCount = torchCells.length;
    if (!bounds) {
      this.sky.fill(0);
      this.torch.fill(0);
      this.skyIncoming = null;
      this.torchIncoming = null;
    } else {
      // Everything the edit could have darkened is recomputed from scratch
      // inside the window; outside cells keep their previous values. Boundary
      // seeds are captured first so the flood still sees light from outside.
      this.skyIncoming = gatherIncoming("sky", bounds, this.sky, trans);
      this.torchIncoming = gatherIncoming("torch", bounds, this.torch, trans);
      clearWindow(this.sky, bounds);
      clearWindow(this.torch, bounds);
    }
    this.current = this.makeFlood("sky");
  }

  private makeFlood(mode: "sky" | "torch") {
    return createFlood({
      trans: this.trans,
      mode,
      field: mode === "sky" ? this.sky : this.torch,
      bounds: this.bounds,
      torchCells: this.torchCells,
      incoming:
        mode === "sky"
          ? (this.skyIncoming ?? undefined)
          : (this.torchIncoming ?? undefined),
    });
  }

  get done() {
    return this.abandoned || this.stage === 2;
  }

  get visited() {
    return this.total;
  }

  get torchTotal() {
    return this.torchCount;
  }

  /** Expand at most `budget` heap entries. Returns true when finished. */
  step(budget: number): boolean {
    if (this.done) return true;
    if (!this.current)
      this.current = this.makeFlood(this.stage === 0 ? "sky" : "torch");
    this.total += this.current.step(budget);
    if (!this.current.done) return false;
    if (this.stage === 0) {
      this.stage = 1;
      this.current = this.makeFlood("torch");
      // Let small torch floods finish in the same call, but never go past the
      // caller's budget for the frame.
      this.total += this.current.step(0);
      if (this.current.done) {
        this.stage = 2;
        this.current = null;
        return true;
      }
      return false;
    }
    this.stage = 2;
    this.current = null;
    return true;
  }

  result(): SolverResult {
    return {
      sky: this.sky,
      torch: this.torch,
      visited: this.total,
      enclosed: countEnclosed(this.trans, this.sky, this.torchCells),
    };
  }

  /** Abandon the job; anything it produces afterwards must be ignored. */
  discard() {
    this.abandoned = true;
    this.current = null;
  }
}

function clearWindow(field: Float32Array, b: Bounds) {
  for (let z = b.z0; z <= b.z1; z++)
    for (let y = b.y0; y <= b.y1; y++) {
      const row = z * SZ + y * SY;
      field.fill(0, row + b.x0, row + b.x1 + 1);
    }
}

/**
 * Reads the one-cell shell just outside the window and converts each outside
 * cell's light into a seed for its inside neighbour, applying the same
 * direction-dependent attenuation the flood itself uses.
 */
function gatherIncoming(
  mode: "sky" | "torch",
  b: Bounds,
  field: Float32Array,
  trans: Float32Array,
): IncomingSeed[] {
  const out: IncomingSeed[] = [];
  const add = (from: number, to: number, dir: "side" | "down" | "up") => {
    const v = field[from];
    if (v < CUTOFF) return;
    const t = trans[to];
    if (t <= 0) return;
    const atten =
      mode === "torch"
        ? TORCH_ATTENUATION
        : dir === "side"
          ? SKY_ATTENUATION
          : dir === "down"
            ? 1
            : SKY_UP_ATTENUATION;
    const lit = v * t * atten;
    if (lit >= CUTOFF) out.push({ i: to, v: lit });
  };
  for (let z = b.z0; z <= b.z1; z++)
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const i = z * SZ + y * SY + x;
        if (x === b.x0 && b.x0 > 0) add(i - SX, i, "side");
        if (x === b.x1 && b.x1 < W - 1) add(i + SX, i, "side");
        if (y === b.y1 && b.y1 < H - 1) add(i + SY, i, "down");
        if (y === b.y0 && b.y0 > 0) add(i - SY, i, "up");
        if (z === b.z0 && b.z0 > 0) add(i - SZ, i, "side");
        if (z === b.z1 && b.z1 < D - 1) add(i + SZ, i, "side");
      }
  return out;
}
