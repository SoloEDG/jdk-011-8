import type { WorldDocument } from "../../../shared/document";
import { inside, key } from "../../../shared/document";
import { materials } from "../../../shared/materials";
export function encode(doc: WorldDocument) {
  return JSON.stringify(doc);
}
export function decode(raw: string): WorldDocument {
  if (raw.length > 5_000_000) throw Error("世界文件过大");
  const d = JSON.parse(raw);
  if (
    d.version !== 1 ||
    typeof d.name !== "string" ||
    !d.blocks ||
    !d.inventory ||
    !d.player
  )
    throw Error("无法识别的世界文件");
  const entries = Object.entries(d.blocks);
  if (entries.length > 20480) throw Error("方块数量超出世界边界");
  for (const [k, b] of entries as [string, any][]) {
    if (
      ![b.x, b.y, b.z].every(Number.isInteger) ||
      !inside(b) ||
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
  return d;
}
