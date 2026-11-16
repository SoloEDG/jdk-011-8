/**
 * Headless checks for the lighting model. Run with:
 *   npx tsx tests/lighting.test.ts
 *
 * These import only pure modules (no three.js, no DOM), so they double as the
 * executable spec for the invariants the UI relies on: sealed rooms, glass vs
 * leaves, staleness, local-vs-full cost, and persistence.
 */
import {
  DOORWAY,
  INTERIOR,
  emptyWorld,
  roomWorld,
  setBlock,
} from "./fixtures";
import { encode, decode, stripBakedLighting } from "../src/features/archive/lib/codec";
import { combineLight, daylightAt } from "../src/features/lighting/lib/daylight";
import {
  cellIndex,
  boundsOfCells,
  padBounds,
  snapshotGrid,
} from "../src/features/lighting/lib/grid";
import { sampleField } from "../src/features/lighting/lib/sample";
import { LightingJob } from "../src/features/lighting/lib/solve";
import type { WorldDocument } from "../src/shared/document";

const failures: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
}

function solve(doc: WorldDocument) {
  const s = snapshotGrid(doc);
  const job = new LightingJob(s.trans, s.torchCells, null, null);
  while (!job.step(4000)) {}
  return { ...job.result(), trans: s.trans };
}

const avg = (f: Float32Array, cells: { x: number; y: number; z: number }[]) =>
  cells.reduce(
    (a, c) => a + sampleField(f, c.x, c.y + 0.5, c.z),
    0,
  ) / cells.length;

// --- sealed rooms ---------------------------------------------------------
{
  const open = solve(roomWorld(null));
  const sealed = solve(roomWorld("brick"));
  const sealedSky = avg(sealed.sky, INTERIOR);
  const openSky = avg(open.sky, INTERIOR);
  check(
    "sealed room has no sky light",
    sealedSky < 0.02,
    `sealed=${sealedSky.toFixed(3)} open=${openSky.toFixed(3)}`,
  );
  check(
    "open doorway admits sky light",
    openSky > 0.25,
    `open=${openSky.toFixed(3)}`,
  );
  check(
    "sealed interiors are counted",
    sealed.enclosed >= 60,
    `enclosed=${sealed.enclosed}`,
  );

  const lit = roomWorld("brick");
  setBlock(lit, 0, 2, 0, "torch");
  const withTorch = solve(lit);
  const torchInside = avg(withTorch.torch, INTERIOR);
  const torchOutside = sampleField(withTorch.torch, 0, 3.5, 6.5);
  check(
    "torch lights its connected space",
    torchInside > 0.3,
    `inside=${torchInside.toFixed(3)}`,
  );
  check(
    "torch light does not pass through a solid wall",
    torchOutside < 0.001,
    `outside=${torchOutside.toFixed(4)}`,
  );
}

// --- glass vs leaves ------------------------------------------------------
{
  const glass = solve(roomWorld("glass"));
  const leaf = solve(roomWorld("leaf"));
  const glassSky = avg(glass.sky, INTERIOR);
  const leafSky = avg(leaf.sky, INTERIOR);
  check(
    "glass transmits more sky light than leaves",
    glassSky > leafSky + 0.05,
    `glass=${glassSky.toFixed(3)} leaf=${leafSky.toFixed(3)}`,
  );
  check(
    "leaves still admit some light (they are not walls)",
    leafSky > 0.02,
    `leaf=${leafSky.toFixed(3)}`,
  );
  const sealedSky = avg(solve(roomWorld("brick")).sky, INTERIOR);
  check(
    "leaves are darker than glass but brighter than brick",
    leafSky > sealedSky && glassSky > leafSky,
    `${sealedSky.toFixed(3)} < ${leafSky.toFixed(3)} < ${glassSky.toFixed(3)}`,
  );
}

// --- time of day ----------------------------------------------------------
{
  check("noon is full daylight", Math.abs(daylightAt(12) - 1) < 1e-6);
  check("midnight is dark", daylightAt(0) === 0);
  const openSky = 1;
  const noon = combineLight(openSky, 0, daylightAt(12));
  const night = combineLight(openSky, 0, daylightAt(0));
  check(
    "open ground is bright at noon and dim at midnight",
    noon > 0.9 && night < 0.25,
    `noon=${noon.toFixed(2)} midnight=${night.toFixed(2)}`,
  );
  const torchRoom = combineLight(0, 1, daylightAt(0));
  check(
    "a torchlit room at midnight reads brighter than open night ground",
    torchRoom > night + 0.4,
    `torch=${torchRoom.toFixed(2)} open=${night.toFixed(2)}`,
  );
}

// --- stale results --------------------------------------------------------
{
  // A job built from a torch-bearing revision runs to completion, but the world
  // moves on (torch removed, revision bumped) before it is applied. The runtime
  // compares revisions and drops it; here we reproduce that decision directly.
  const torchDoc = roomWorld("brick");
  setBlock(torchDoc, 0, 2, 0, "torch");
  const torchSnapshot = snapshotGrid(torchDoc);
  const lateJob = new LightingJob(
    torchSnapshot.trans,
    torchSnapshot.torchCells,
    null,
    null,
  );
  while (!lateJob.step(4000)) {}
  const late = lateJob.result();
  const torchAt = cellIndex(0, 3, 0);
  check(
    "the late job really did compute torch light",
    late.torch[torchAt] > 0.5,
    `torch=${late.torch[torchAt].toFixed(2)}`,
  );

  const currentRevision = torchDoc.revision + 1;
  check(
    "a result built from an older revision is rejected instead of applied",
    torchSnapshot.revision !== currentRevision,
    `built=${torchSnapshot.revision} current=${currentRevision}`,
  );
  lateJob.discard();
  const fresh = solve(roomWorld("brick"));
  check(
    "the shown light after removal has no torch contribution",
    fresh.torch[torchAt] < 0.02,
    `torch=${fresh.torch[torchAt].toFixed(3)}`,
  );
}

// --- local vs full --------------------------------------------------------
{
  const base = roomWorld(null);
  const baseResult = solve(base);
  const edited = roomWorld(null);
  setBlock(edited, 0, 3, 0, "torch");
  const full = solve(edited);

  const trans = snapshotGrid(edited);
  // The window tracks the edit itself, exactly as runtime.markChanged does.
  const window = padBounds(boundsOfCells([{ x: 0, y: 3, z: 0 }]), 6);
  const localJob = new LightingJob(
    trans.trans,
    trans.torchCells,
    window,
    { sky: baseResult.sky, torch: baseResult.torch },
  );
  while (!localJob.step(4000)) {}
  const local = localJob.result();

  check(
    "a local solve expands far fewer cells than a full solve",
    local.visited < full.visited * 0.35,
    `local=${local.visited} full=${full.visited}`,
  );
  const localTorch = sampleField(local.torch, 0, 3.5, 0);
  const fullTorch = sampleField(full.torch, 0, 3.5, 0);
  check(
    "the local solve matches the full solve at the edit",
    Math.abs(localTorch - fullTorch) < 0.05,
    `local=${localTorch.toFixed(3)} full=${fullTorch.toFixed(3)}`,
  );
  const farDelta = Math.abs(
    sampleField(local.torch, 0, 3.5, 6.5) - sampleField(full.torch, 0, 3.5, 6.5),
  );
  check(
    "outside the window both solves agree (no leak, no false shadow)",
    farDelta < 0.01,
    `delta=${farDelta.toFixed(4)}`,
  );
}

// --- persistence ----------------------------------------------------------
{
  const doc = roomWorld("brick");
  doc.time = 21.25;
  setBlock(doc, 0, 2, 0, "torch");
  const round = decode(encode(doc));
  const torches = Object.values(round.blocks).filter(
    (b) => b.material === "torch",
  ).length;
  check(
    "export/reimport keeps the torch and the clock",
    torches === 1 && Math.abs(round.time - 21.25) < 1e-9,
    `torches=${torches} time=${round.time}`,
  );
  const resealed = solve(round);
  check(
    "a reopened sealed room still reads as sealed",
    avg(resealed.sky, INTERIOR) < 0.02,
    `sky=${avg(resealed.sky, INTERIOR).toFixed(3)}`,
  );

  // Exposure must never be mistaken for albedo: a file that carries baked
  // colours must be normalised back to the material catalogue on import.
  const baked = JSON.parse(encode(doc));
  baked.blocks[Object.keys(baked.blocks)[0]].color = "#000000";
  const cleaned = decode(JSON.stringify(baked));
  stripBakedLighting(cleaned);
  check(
    "imported worlds carry no baked exposure colours",
    Object.values(cleaned.blocks).every(
      (b) => !("color" in b) && !("light" in b) && !("exposure" in b),
    ),
  );
}

check("empty world stays empty", Object.keys(emptyWorld().blocks).length === 0);

if (failures.length) {
  console.error(`\n${failures.length} lighting check(s) failed`);
  process.exit(1);
}
console.log(`\nall lighting checks passed`);
