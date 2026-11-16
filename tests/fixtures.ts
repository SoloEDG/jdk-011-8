/**
 * Pure-data fixtures for lighting tests: a sealed room, a glazed room, etc.
 * Imported by scripts/lighting-check.ts, which runs under tsx.
 */
import type { MaterialId, WorldDocument } from "../src/shared/document";
import { key } from "../src/shared/document";
import { initialStock } from "../src/shared/materials";

export function emptyWorld(time = 12): WorldDocument {
  return {
    version: 2,
    name: "test",
    blocks: {},
    inventory: initialStock(),
    player: { x: 0, y: 2, z: 0 },
    revision: 0,
    time,
  };
}

export function setBlock(
  doc: WorldDocument,
  x: number,
  y: number,
  z: number,
  material: MaterialId | null,
) {
  const k = key({ x, y, z });
  if (material === null) delete doc.blocks[k];
  else doc.blocks[k] = { x, y, z, material };
}

export const DOORWAY = [
  { x: -1, y: 2, z: 3 },
  { x: 0, y: 2, z: 3 },
  { x: 1, y: 2, z: 3 },
  { x: -1, y: 3, z: 3 },
  { x: 0, y: 3, z: 3 },
  { x: 1, y: 3, z: 3 },
];

/**
 * A 7×7 brick hut with a wooden floor, a solid roof and a 3×2 doorway in the
 * +z wall. `door` fills the doorway with glass/leaf/brick (or null for open).
 */
export function roomWorld(door: MaterialId | null): WorldDocument {
  const doc = emptyWorld();
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) setBlock(doc, x, 1, z, "wood");
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++)
      for (let y = 2; y <= 6; y++) {
        if (y === 6) {
          setBlock(doc, x, y, z, "brick");
          continue;
        }
        const onWall = x === -3 || x === 3 || z === -3 || z === 3;
        if (!onWall) continue;
        const inDoorway = z === 3 && x >= -1 && x <= 1 && y <= 3;
        if (inDoorway) {
          if (door) setBlock(doc, x, y, z, door);
          continue;
        }
        setBlock(doc, x, y, z, "brick");
      }
  return doc;
}

/** Interior air cells used by the checks. */
export const INTERIOR = [
  { x: 0, y: 3, z: 0 },
  { x: 2, y: 4, z: -2 },
  { x: -1, y: 2.2, z: 1 },
];
