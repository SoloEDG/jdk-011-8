import { key, type Workspace } from "../../../shared/document";
import { regionCells } from "./region";
export function regionSummary(s: Workspace) {
  if (!s.region) return { volume: 0, occupied: 0, empty: 0 };
  const cells = regionCells(s.region);
  const occupied = cells.filter((p) => s.doc.blocks[key(p)]).length;
  return { volume: cells.length, occupied, empty: cells.length - occupied };
}
