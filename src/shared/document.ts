export type MaterialId =
  | "grass"
  | "soil"
  | "stone"
  | "wood"
  | "sand"
  | "brick"
  | "glass"
  | "leaf"
  | "torch";
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Block extends Vec3 {
  material: MaterialId;
}
/**
 * A world is only ever authored state: blocks, stock, player, clock.
 * Sky light, torch light and sealed-room darkness are derived from this state
 * (see features/lighting) and must never be baked into `blocks`.
 */
export interface WorldDocument {
  version: 2;
  name: string;
  blocks: Record<string, Block>;
  inventory: Record<MaterialId, number>;
  player: Vec3;
  revision: number;
  /** Local solar time in hours, 0..24. 6 sunrise, 12 noon, 18 sunset. */
  time: number;
}
export interface Region {
  a: Vec3;
  b: Vec3;
}
export type Tool = "place" | "remove" | "select";
/** `local` re-propagates a bounded radius; `full` floods the whole volume. */
export type LightingMode = "local" | "full";
/**
 * Where the character's eyes are: fully outdoors, sheltered (indoors but daylit
 * through openings), lit mainly by a torch, or sealed and unlit.
 */
export type Exposure = "open" | "sheltered" | "torchlit" | "dark" | "unknown";
/** What the character's eyes receive, derived from blocks + time. */
export interface LightingView {
  status: "idle" | "computing" | "ready";
  mode: LightingMode;
  /** Combined illumination 0..1, from the same formula the renderer uses. */
  level: number;
  /** Raw sky/torch components at eye height before time-of-day weighting. */
  sky: number;
  torch: number;
  exposure: Exposure;
  /** True when the applied field came from a bounded, local re-solve. */
  approximate: boolean;
  /** A solve is queued or running, or a stale result was just dropped. */
  pending: boolean;
  torches: number;
  /** Non-solid, non-torch cells with no sky access (sealed interiors). */
  enclosed: number;
  /** Solver expansions of the applied (or in-flight) job. */
  visited: number;
  /** Solver milliseconds of the applied (or in-flight) job. */
  elapsed: number;
  /** Late results thrown away because the world changed under them. */
  discarded: number;
  fieldRevision: number;
  daylight: number;
}
export interface Workspace {
  doc: WorldDocument;
  material: MaterialId;
  tool: Tool;
  region: Region | null;
  anchor: Vec3 | null;
  message: string;
  dirty: boolean;
  mode: "build" | "walk";
  savedAt: string | null;
  clockPlaying: boolean;
  lighting: LightingView;
}
export const WORLD = {
  minX: -16,
  maxX: 15,
  minY: 0,
  maxY: 19,
  minZ: -16,
  maxZ: 15,
} as const;
export const WORLD_WIDTH = WORLD.maxX - WORLD.minX + 1;
export const WORLD_HEIGHT = WORLD.maxY - WORLD.minY + 1;
export const WORLD_DEPTH = WORLD.maxZ - WORLD.minZ + 1;
export const key = (p: Vec3) => `${p.x},${p.y},${p.z}`;
export const inside = (p: Vec3) =>
  p.x >= WORLD.minX &&
  p.x <= WORLD.maxX &&
  p.z >= WORLD.minZ &&
  p.z <= WORLD.maxZ &&
  p.y >= WORLD.minY &&
  p.y <= WORLD.maxY;
/** Normalises hours into [0, 24); non-finite input falls back to morning. */
export const clampTime = (value: number) => {
  if (!Number.isFinite(value)) return 9.5;
  return ((value % 24) + 24) % 24;
};
