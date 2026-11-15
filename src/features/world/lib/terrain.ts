import type { Block, WorldDocument } from "../../../shared/document";
import { key } from "../../../shared/document";
import { initialStock } from "../../../shared/materials";
export function createWorld(): WorldDocument {
  const blocks: Record<string, Block> = {};
  const put = (
    x: number,
    y: number,
    z: number,
    material: Block["material"],
  ) => {
    const b = { x, y, z, material };
    blocks[key(b)] = b;
  };
  for (let x = -11; x <= 11; x++)
    for (let z = -11; z <= 11; z++) {
      put(x, 0, z, "soil");
      put(x, 1, z, "grass");
    }
  for (let x = -4; x <= 3; x++)
    for (let z = -4; z <= 2; z++) put(x, 2, z, "wood");
  for (let y = 3; y <= 6; y++) {
    for (let x = -4; x <= 3; x++) {
      put(x, y, -4, y === 4 ? "glass" : "brick");
      if (x !== -1 && x !== 0) put(x, y, 2, "brick");
    }
    for (let z = -3; z <= 1; z++) {
      put(-4, y, z, y === 4 ? "glass" : "brick");
      put(3, y, z, y === 4 ? "glass" : "brick");
    }
  }
  for (let x = -5; x <= 4; x++)
    for (let z = -5; z <= 3; z++) put(x, 7, z, "wood");
  for (const [tx, tz] of [
    [7, 6],
    [-7, -6],
    [6, -7],
  ]) {
    for (let y = 2; y < 6; y++) put(tx, y, tz, "wood");
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        for (let y = 5; y <= 7; y++)
          if (Math.abs(x) + Math.abs(z) < 4) put(tx + x, y, tz + z, "leaf");
  }
  for (let z = 3; z < 11; z++)
    for (let x = -1; x <= 0; x++) put(x, 2, z, "sand");
  return {
    version: 1,
    name: "林间小屋",
    blocks,
    inventory: initialStock(),
    player: { x: 0, y: 3, z: 9 },
    revision: 0,
  };
}
