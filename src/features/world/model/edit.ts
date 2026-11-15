import {
  inside,
  key,
  type Workspace,
  type Vec3,
  type Block,
} from "../../../shared/document";
import { overlapsPlayer } from "../lib/queries";
import type { EditResult } from "../../../shared/commands";
export function editCells(
  s: Workspace,
  cells: Vec3[],
  remove = false,
): EditResult {
  const unique = [...new Map(cells.map((p) => [key(p), p])).values()];
  const changed: Block[] = [];
  for (const p of unique) {
    const old = s.doc.blocks[key(p)];
    if (!inside(p) || (!remove && old) || (remove && (!old || p.y === 0)))
      continue;
    if (!remove && overlapsPlayer(p, s.doc.player))
      return { ok: false, message: "这里是角色所在位置", changed: [] };
    changed.push(remove ? old! : { ...p, material: s.material });
  }
  if (!remove && s.doc.inventory[s.material] < changed.length)
    return { ok: false, message: "物品数量不足，未进行建造", changed: [] };
  for (const b of changed) {
    if (remove) {
      delete s.doc.blocks[key(b)];
      s.doc.inventory[b.material]++;
    } else {
      s.doc.blocks[key(b)] = b;
      s.doc.inventory[b.material]--;
    }
  }
  if (changed.length) {
    s.doc.revision++;
    s.dirty = true;
  }
  return {
    ok: true,
    message: changed.length
      ? `${remove ? "拆除" : "放置"}了 ${changed.length} 个方块`
      : "没有可修改的方块",
    changed,
  };
}
