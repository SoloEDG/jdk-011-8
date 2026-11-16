/**
 * Integration checks for the scheduling runtime: frame-budgeted solves,
 * invalidation, local-vs-full mode, and discarding late results. Runs under
 * tsx with no DOM: the runtime only needs a Workspace-shaped object.
 */
import {
  initialLightingView,
  createLightingRuntime,
} from "../src/features/lighting/model/runtime";
import { roomWorld, setBlock } from "./fixtures";
import type { Workspace } from "../src/shared/document";
import { key } from "../src/shared/document";
import { createWorld } from "../src/features/world/lib/terrain";

const failures: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
}

function makeWorkspace(): Workspace {
  const doc = createWorld();
  return {
    doc,
    material: "grass",
    tool: "place",
    region: null,
    anchor: null,
    message: "",
    dirty: false,
    mode: "build",
    savedAt: null,
    clockPlaying: false,
    lighting: initialLightingView(),
  };
}

/** Edit cells while keeping revision and runtime bookkeeping consistent. */
function edit(w: Workspace, cells: { x: number; y: number; z: number }[], material: string) {
  const changed = [];
  for (const c of cells) {
    setBlock(w.doc, c.x, c.y, c.z, material as never);
    changed.push({ ...c, material: material as never });
  }
  w.doc.revision++;
  return changed;
}
function remove(w: Workspace, cells: { x: number; y: number; z: number }[]) {
  const changed = cells.map((c) => ({ ...c, material: w.doc.blocks[key(c)]!.material }));
  for (const c of cells) setBlock(w.doc, c.x, c.y, c.z, null);
  w.doc.revision++;
  return changed;
}

function settle(w: Workspace, runtime: ReturnType<typeof createLightingRuntime>, frames = 400) {
  for (let i = 0; i < frames; i++) {
    runtime.tick(w.doc, 4);
    if (w.lighting.status === "ready" && !w.lighting.pending) return i + 1;
  }
  return -1;
}

// Initial build is synchronous and exact.
{
  const w = makeWorkspace();
  w.doc.player = { x: 0, y: 3, z: 0 }; // stand inside the cottage
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  check(
    "rebuildNow leaves a ready, exact field",
    w.lighting.status === "ready" && !w.lighting.approximate,
    `status=${w.lighting.status}`,
  );
  check(
    "standing under a roof samples roof-filtered light, not full sky",
    w.lighting.sky > 0.15 && w.lighting.sky < 0.95,
    `sky=${w.lighting.sky}`,
  );
}

// Local edit resolves over multiple frames and is flagged approximate.
{
  const w = makeWorkspace();
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  runtime.setMode("local");
  const changed = edit(w, [{ x: 8, y: 2, z: 8 }], "brick"); // isolated block, away from house
  runtime.markChanged(changed as never);
  const frames = settle(w, runtime);
  check("a local edit settles within 400 frames", frames > 0, `frames=${frames}`);
  check("local mode flags the result as approximate", w.lighting.approximate);
  check(
    "local edit remains much cheaper than a full solve",
    w.lighting.visited < 20000,
    `visited=${w.lighting.visited}`,
  );
}

// Full mode always rebuilds exactly.
{
  const w = makeWorkspace();
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  runtime.setMode("full");
  const changed = edit(w, [{ x: 8, y: 2, z: 8 }], "brick");
  runtime.markChanged(changed as never);
  settle(w, runtime);
  check("full mode reports an exact field", !w.lighting.approximate, `approx=${w.lighting.approximate}`);
}

// Sealing a doorway makes the frame that the UI shows go dark.
{
  const w = makeWorkspace();
  w.doc = roomWorld(null);
  w.doc.revision = 0;
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  const litSky = w.lighting.sky;

  const doorway = [
    { x: -1, y: 2, z: 3 },
    { x: 0, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: -1, y: 3, z: 3 },
    { x: 0, y: 3, z: 3 },
    { x: 1, y: 3, z: 3 },
  ];
  // Stand inside the room so the readout is the interior.
  w.doc.player = { x: 0, y: 2, z: 0 };
  const changed = edit(w, doorway, "brick");
  runtime.markChanged(changed as never);
  settle(w, runtime);
  check(
    "sealing the doorway darkens the interior the character sees",
    w.lighting.sky < 0.02 && litSky > 0.2,
    `before=${litSky.toFixed(2)} after=${w.lighting.sky.toFixed(3)}`,
  );
  check("the sealed room is reported as dark", w.lighting.exposure === "dark", w.lighting.exposure);
}

// Torch removal while a solve is in flight: the late result is never shown.
{
  const w = makeWorkspace();
  w.doc = roomWorld("brick");
  w.doc.revision = 0;
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  w.doc.player = { x: 0, y: 2, z: 0 };

  const placed = edit(w, [{ x: 0, y: 2, z: 0 }], "torch");
  runtime.markChanged(placed as never);
  settle(w, runtime);
  const litTorch = w.lighting.torch;

  // Remove the torch and immediately ask for full propagation; the queued job
  // is built from the removal revision. A late torch-bearing job must never
  // land on top.
  runtime.setMode("full");
  const removed = remove(w, [{ x: 0, y: 2, z: 0 }]);
  runtime.markChanged(removed as never);
  settle(w, runtime);
  check(
    "torch light disappears once the torch is removed",
    litTorch > 0.5 && w.lighting.torch < 0.02,
    `lit=${litTorch.toFixed(2)} after=${w.lighting.torch.toFixed(3)}`,
  );
  check(
    "no late torch result is displayed",
    w.lighting.status === "ready" && w.lighting.fieldRevision === w.doc.revision,
    `field=${w.lighting.fieldRevision} world=${w.doc.revision}`,
  );
}

// Time changes never trigger a solve and never change the material colours.
{
  const w = makeWorkspace();
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  const before = w.lighting.level;
  const revision = w.doc.revision;
  w.doc.time = 0;
  runtime.tick(w.doc, 4);
  check(
    "changing the clock does not invalidate the light field",
    w.doc.revision === revision && w.lighting.fieldRevision === revision,
  );
  check(
    "midnight is dimmer than daytime for the same world",
    w.lighting.level < before,
    `day=${before.toFixed(2)} night=${w.lighting.level.toFixed(2)}`,
  );
  check(
    "block records keep only x/y/z/material",
    Object.values(w.doc.blocks).every(
      (b) => Object.keys(b).sort().join(",") === "material,x,y,z",
    ),
  );
}

// Continuous building: every frame makes an edit. The scheduler must not start
// a solve while edits are still streaming, and must catch up once they stop.
{
  const w = makeWorkspace();
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  let solveStartedDuringBuilding = false;
  for (let i = 0; i < 30; i++) {
    const cell = { x: 10, y: 2 + (i % 3), z: -10 + (i % 4) };
    const changed = edit(w, [cell], "brick");
    runtime.markChanged(changed as never);
    runtime.tick(w.doc, 2);
    if (w.lighting.status === "computing") solveStartedDuringBuilding = true;
  }
  check(
    "no solve starts while edits are arriving every frame",
    !solveStartedDuringBuilding,
    `status=${w.lighting.status}`,
  );
  const frames = settle(w, runtime);
  check(
    "lighting catches up after continuous building stops",
    frames > 0 && w.lighting.fieldRevision === w.doc.revision,
    `frames=${frames} field=${w.lighting.fieldRevision} world=${w.doc.revision}`,
  );
}

// A loaded world rebuilds exactly rather than reusing a stale field.
{
  const w = makeWorkspace();
  const runtime = createLightingRuntime(w);
  runtime.rebuildNow();
  const fresh = roomWorld("brick");
  fresh.revision = w.doc.revision + 1;
  fresh.time = 18.5;
  w.doc = fresh;
  runtime.invalidate();
  settle(w, runtime);
  check(
    "invalidated field is rebuilt for the new revision",
    w.lighting.fieldRevision === fresh.revision,
    `field=${w.lighting.fieldRevision} doc=${fresh.revision}`,
  );
  check("a rebuild after load is exact, not approximate", !w.lighting.approximate);
}

if (failures.length) {
  console.error(`\n${failures.length} runtime check(s) failed`);
  process.exit(1);
}
console.log("\nall runtime checks passed");

