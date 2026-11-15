import type { Workspace, MaterialId } from "../../../shared/document";
import { materials } from "../../../shared/materials";
export const stockTotal = (s: Workspace) =>
  Object.values(s.doc.inventory).reduce((a, b) => a + b, 0);
export function stockRows(s: Workspace, search: string) {
  return materials
    .filter((m) => m.name.includes(search))
    .map((m) => ({
      ...m,
      count: s.doc.inventory[m.id],
      active: m.id === s.material,
    }));
}
export function canSupply(s: Workspace, id: MaterialId, count: number) {
  return Number.isInteger(count) && count >= 0 && s.doc.inventory[id] >= count;
}
