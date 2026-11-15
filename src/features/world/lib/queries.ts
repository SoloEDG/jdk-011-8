import type { WorldDocument, Vec3 } from "../../../shared/document";
import { key } from "../../../shared/document";
import type { WorldSummary } from "../../../shared/commands";
export const at = (doc: WorldDocument, p: Vec3) => doc.blocks[key(p)];
export function summarize(doc: WorldDocument): WorldSummary {
  const b = Object.values(doc.blocks);
  return {
    total: b.length,
    highest: Math.max(0, ...b.map((v) => v.y)) + 1,
    materials: new Set(b.map((v) => v.material)).size,
  };
}
export function overlapsPlayer(p: Vec3, player: Vec3) {
  return (
    Math.abs(p.x + 0.5 - player.x) < 0.78 &&
    Math.abs(p.z + 0.5 - player.z) < 0.78 &&
    p.y < player.y + 1.7 &&
    p.y + 1 > player.y
  );
}
