import type { Workspace, MaterialId } from "../../../shared/document";
export function chooseMaterial(s: Workspace, id: MaterialId) {
  s.material = id;
  s.tool = "place";
  s.message = "已切换建造材质";
}
export function selectSlot(s: Workspace, slot: number) {
  const ids: MaterialId[] = [
    "grass",
    "soil",
    "stone",
    "wood",
    "sand",
    "brick",
    "glass",
    "leaf",
  ];
  if (ids[slot]) chooseMaterial(s, ids[slot]);
}
