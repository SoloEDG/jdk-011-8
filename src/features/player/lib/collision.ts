import { key, type Vec3, type WorldDocument } from "../../../shared/document";
export function collides(doc: WorldDocument, p: Vec3) {
  for (let x = Math.floor(p.x - 0.28); x <= Math.floor(p.x + 0.28); x++)
    for (let z = Math.floor(p.z - 0.28); z <= Math.floor(p.z + 0.28); z++)
      for (let y = Math.floor(p.y + 0.01); y <= Math.floor(p.y + 1.65); y++)
        if (doc.blocks[key({ x, y, z })]) return true;
  return false;
}
