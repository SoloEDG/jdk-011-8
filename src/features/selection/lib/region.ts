import type { Region, Vec3 } from "../../../shared/document";
export function regionCells(r: Region): Vec3[] {
  const cells: Vec3[] = [];
  for (let x = Math.min(r.a.x, r.b.x); x <= Math.max(r.a.x, r.b.x); x++)
    for (let y = Math.min(r.a.y, r.b.y); y <= Math.max(r.a.y, r.b.y); y++)
      for (let z = Math.min(r.a.z, r.b.z); z <= Math.max(r.a.z, r.b.z); z++)
        cells.push({ x, y, z });
  return cells;
}
export const dimensions = (r: Region) => ({
  x: Math.abs(r.a.x - r.b.x) + 1,
  y: Math.abs(r.a.y - r.b.y) + 1,
  z: Math.abs(r.a.z - r.b.z) + 1,
});
