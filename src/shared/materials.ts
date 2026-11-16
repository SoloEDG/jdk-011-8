import type { MaterialId } from "./document";
export interface MaterialSpec {
  id: MaterialId;
  name: string;
  /** Base albedo. Never mutated by lighting or exposure — see archive codec. */
  color: string;
  solid: boolean;
  /**
   * Share of sky/torch light that passes through the cell, 0..1.
   * This is what the light solver reads. Glass and leaves differ here, which
   * is why "glass transmits" and "leaves shade" are explained by one rule.
   */
  lightTransmission: number;
  /** Renderer transparency only; never read by the solver. */
  alpha: number;
  /** Emissive flame rendering for torches. */
  emitsLight?: boolean;
}
export const materials: MaterialSpec[] = [
  { id: "grass", name: "草方块", color: "#78a44b", solid: true, lightTransmission: 0, alpha: 1 },
  { id: "soil", name: "泥土", color: "#96704f", solid: true, lightTransmission: 0, alpha: 1 },
  { id: "stone", name: "岩石", color: "#99a4a5", solid: true, lightTransmission: 0, alpha: 1 },
  { id: "wood", name: "橡木", color: "#b58a55", solid: true, lightTransmission: 0, alpha: 1 },
  { id: "sand", name: "沙地", color: "#e3ce95", solid: true, lightTransmission: 0, alpha: 1 },
  { id: "brick", name: "砖块", color: "#bd735c", solid: true, lightTransmission: 0, alpha: 1 },
  // Glass passes most light but still tints/refracts it, so a glazed wall is
  // bright while the glass cell itself only sees ~78% of the outside sky.
  { id: "glass", name: "玻璃", color: "#a4dce0", solid: true, lightTransmission: 0.78, alpha: 0.32 },
  // Leaves are translucent but dense: a canopy lets a dappled third through,
  // making a shaded room measurably darker than a glazed one.
  { id: "leaf", name: "树叶", color: "#4d8650", solid: true, lightTransmission: 0.32, alpha: 1 },
  // Torches are non-solid light sources: they occupy a cell but never block
  // movement or cast shadows, and they seed the torch light field.
  { id: "torch", name: "火把", color: "#f4c36a", solid: false, lightTransmission: 1, alpha: 1, emitsLight: true },
];
export const materialSpec = (id: MaterialId) =>
  materials.find((m) => m.id === id)!;
export const isSolid = (id: MaterialId) => materialSpec(id).solid;
export const initialStock = () =>
  Object.fromEntries(
    materials.map((m) => [m.id, m.id === "torch" ? 64 : 256]),
  ) as Record<MaterialId, number>;
/** Hot-loop lookup used by the solver's grid snapshot. */
export const transmissionTable: Record<MaterialId, number> = Object.fromEntries(
  materials.map((m) => [m.id, m.lightTransmission]),
) as Record<MaterialId, number>;
