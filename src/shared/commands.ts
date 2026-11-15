import type { Block, Vec3 } from "./document";
export interface EditResult {
  ok: boolean;
  message: string;
  changed: Block[];
}
export interface SceneHit {
  cell: Vec3;
  adjacent: Vec3;
}
export interface WorldSummary {
  total: number;
  highest: number;
  materials: number;
}
