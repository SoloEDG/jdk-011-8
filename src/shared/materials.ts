import type { MaterialId } from "./document";
export interface MaterialSpec {
  id: MaterialId;
  name: string;
  color: string;
  solid: boolean;
  opacity: number;
}
export const materials: MaterialSpec[] = [
  { id: "grass", name: "草方块", color: "#78a44b", solid: true, opacity: 1 },
  { id: "soil", name: "泥土", color: "#96704f", solid: true, opacity: 1 },
  { id: "stone", name: "岩石", color: "#99a4a5", solid: true, opacity: 1 },
  { id: "wood", name: "橡木", color: "#b58a55", solid: true, opacity: 1 },
  { id: "sand", name: "沙地", color: "#e3ce95", solid: true, opacity: 1 },
  { id: "brick", name: "砖块", color: "#bd735c", solid: true, opacity: 1 },
  { id: "glass", name: "玻璃", color: "#a4dce0", solid: true, opacity: 0.38 },
  { id: "leaf", name: "树叶", color: "#4d8650", solid: true, opacity: 1 },
];
export const materialSpec = (id: MaterialId) =>
  materials.find((m) => m.id === id)!;
export const initialStock = () =>
  Object.fromEntries(materials.map((m) => [m.id, 256])) as Record<
    MaterialId,
    number
  >;
