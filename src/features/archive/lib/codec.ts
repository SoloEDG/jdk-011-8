import type { Workspace, Vec3, WorldDocument } from "../../../shared/document";
import { key } from "../../../shared/document";
import { materials } from "../../../shared/materials";
export function encode(doc: WorldDocument) {
  return JSON.stringify(doc);
}
const INSIDE = (b: Vec3) =>
  b.x >= -16 &&
  b.x < 16 &&
  b.z >= -16 &&
  b.z < 16 &&
  b.y >= 0 &&
  b.y < 20;
export function decode(raw: string): WorldDocument {
  if (raw.length > 5_000_000) throw Error("世界文件过大");
  let d: any;
  try {
    d = JSON.parse(raw);
  } catch {
    throw Error("无法识别的世界文件");
  }
  if (
    !d ||
    (d.version !== 1 && d.version !== 2) ||
    typeof d.name !== "string" ||
    !d.blocks ||
    !d.inventory ||
    !d.player
  )
    throw Error("无法识别的世界文件");
  // v1 predates the clock and torches. Promote it in place rather than
  // rejecting the user's earlier saves; blocks and stock carry over untouched.
  if (d.version === 1) {
    d.version = 2;
    for (const m of materials)
      if (d.inventory[m.id] === undefined) d.inventory[m.id] = m.id === "torch" ? 64 : 0;
  }
  const entries = Object.entries(d.blocks) as [string, any][];
  if (entries.length > 20480) throw Error("方块数量超出世界边界");
  for (const [k, b] of entries) {
    if (
      !b ||
      ![b.x, b.y, b.z].every(Number.isInteger) ||
      !INSIDE(b) ||
      key(b) !== k ||
      !materials.some((m) => m.id === b.material)
    )
      throw Error("文件包含无效方块");
  }
  for (const m of materials)
    if (!Number.isInteger(d.inventory[m.id]) || d.inventory[m.id] < 0)
      throw Error("物品栏数据无效");
  if (![d.player.x, d.player.y, d.player.z].every(Number.isFinite))
    throw Error("角色坐标无效");
  if (!Number.isInteger(d.revision) || d.revision < 0)
    throw Error("世界版本无效");
  // Time is part of the authored state: a world reopened at dusk must look like
  // dusk. Out-of-range or missing values are clamped rather than rejected so
  // hand-edited files stay usable.
  if (d.time === undefined) d.time = 9.5;
  if (typeof d.time !== "number" || !Number.isFinite(d.time))
    throw Error("世界时间无效");
  d.time = ((d.time % 24) + 24) % 24;
  return d as WorldDocument;
}

/**
 * Ensures a world carries no baked exposure. Adapters sometimes hand us files
 * whose block colours were multiplied by a frame's brightness; the material
 * catalogue is the single source of albedo, so any per-block colour is dropped
 * on import instead of being trusted.
 */
export function stripBakedLighting(doc: WorldDocument) {
  for (const b of Object.values(doc.blocks) as any[]) {
    delete b.color;
    delete b.light;
    delete b.exposure;
  }
}
