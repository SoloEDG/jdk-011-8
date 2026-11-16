/**
 * Archive compatibility: old v1 files must still open, v2 keeps the clock, and
 * exposure is never mistaken for albedo.
 */
import { decode, encode, stripBakedLighting } from "../src/features/archive/lib/codec";

const failures: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
}

const v1 = {
  version: 1,
  name: "旧世界",
  blocks: { "0,1,0": { x: 0, y: 1, z: 0, material: "grass" } },
  inventory: { grass: 10, soil: 5, stone: 5, wood: 5, sand: 5, brick: 5, glass: 5, leaf: 5 },
  player: { x: 0, y: 2, z: 0 },
  revision: 3,
};

const upgraded = decode(JSON.stringify(v1));
check("a v1 save still opens", upgraded.version === 2 && upgraded.blocks["0,1,0"].material === "grass");
check("a v1 save gains a default clock", upgraded.time === 9.5, `time=${upgraded.time}`);
check("a v1 save gets torch stock", upgraded.inventory.torch === 64);

const v2 = { ...v1, version: 2, time: 22.5, inventory: { ...v1.inventory, torch: 64 } };
const round = decode(encode(v2 as never));
check("a v2 save keeps its clock", round.time === 22.5);

const outOfRange = decode(JSON.stringify({ ...v2, time: 27.5 }));
check("out-of-range time wraps into a day", outOfRange.time === 3.5, `time=${outOfRange.time}`);
const missing = decode(JSON.stringify({ ...v2, time: undefined }));
check("a missing clock falls back to morning", missing.time === 9.5);

const baked = JSON.parse(encode(v2 as never));
baked.blocks["0,1,0"].color = "#101010";
baked.blocks["0,1,0"].exposure = 0.2;
const cleaned = decode(JSON.stringify(baked));
stripBakedLighting(cleaned);
check(
  "baked exposure is stripped on import",
  !("color" in cleaned.blocks["0,1,0"]) && !("exposure" in cleaned.blocks["0,1,0"]),
);
check(
  "the material itself still supplies the colour",
  cleaned.blocks["0,1,0"].material === "grass",
);

if (failures.length) {
  console.error(`\n${failures.length} codec check(s) failed`);
  process.exit(1);
}
console.log("\nall codec checks passed");
