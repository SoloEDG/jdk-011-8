import {
  WORLD,
  WORLD_DEPTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Block,
  type Vec3,
  type WorldDocument,
} from "../../../shared/document";
import { transmissionTable } from "../../../shared/materials";

/**
 * The light grid mirrors the world volume and is laid out x-fastest, then y,
 * then z, so it can be uploaded to a Data3DTexture without reshuffling.
 */
export const W = WORLD_WIDTH;
export const H = WORLD_HEIGHT;
export const D = WORLD_DEPTH;
export const COUNT = W * H * D;
export const SX = 1;
export const SY = W;
export const SZ = W * H;

export const localX = (x: number) => x - WORLD.minX;
export const localY = (y: number) => y - WORLD.minY;
export const localZ = (z: number) => z - WORLD.minZ;

export const indexX = (i: number) => i % W;
export const indexY = (i: number) => Math.floor(i / SY) % H;
export const indexZ = (i: number) => Math.floor(i / SZ);

export const cellIndex = (x: number, y: number, z: number) =>
  localZ(z) * SZ + localY(y) * SY + localX(x);

export interface Bounds {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

export const fullBounds = (): Bounds => ({
  x0: 0,
  y0: 0,
  z0: 0,
  x1: W - 1,
  y1: H - 1,
  z1: D - 1,
});

export const inBounds = (i: number, b: Bounds) => {
  const x = indexX(i);
  const y = indexY(i);
  const z = indexZ(i);
  return (
    x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1
  );
};

/** Everything the solver needs, frozen at the revision it represents. */
export interface GridSnapshot {
  revision: number;
  /** 0 for opaque cells, otherwise the share of light passed through. */
  trans: Float32Array;
  torchCells: Int32Array;
}

export function snapshotGrid(doc: WorldDocument): GridSnapshot {
  const trans = new Float32Array(COUNT).fill(1);
  const torches: number[] = [];
  for (const b of Object.values(doc.blocks)) {
    const i = cellIndex(b.x, b.y, b.z);
    if (b.material === "torch") torches.push(i);
    else trans[i] = transmissionTable[b.material] ?? 0;
  }
  return {
    revision: doc.revision,
    trans,
    torchCells: Int32Array.from(torches),
  };
}

/** Grid-space bounding box of edited cells, clamped to the world. */
export function boundsOfCells(cells: Vec3[]): Bounds | null {
  if (!cells.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity,
    z1 = -Infinity;
  for (const c of cells) {
    x0 = Math.min(x0, c.x);
    x1 = Math.max(x1, c.x);
    y0 = Math.min(y0, c.y);
    y1 = Math.max(y1, c.y);
    z0 = Math.min(z0, c.z);
    z1 = Math.max(z1, c.z);
  }
  return {
    x0: localX(x0),
    x1: localX(x1),
    y0: localY(y0),
    y1: localY(y1),
    z0: localZ(z0),
    z1: localZ(z1),
  };
}

export function padBounds(b: Bounds, pad: number): Bounds {
  return {
    x0: Math.max(0, b.x0 - pad),
    x1: Math.min(W - 1, b.x1 + pad),
    y0: Math.max(0, b.y0 - pad),
    y1: Math.min(H - 1, b.y1 + pad),
    z0: Math.max(0, b.z0 - pad),
    z1: Math.min(D - 1, b.z1 + pad),
  };
}

export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    x0: Math.min(a.x0, b.x0),
    x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0),
    y1: Math.max(a.y1, b.y1),
    z0: Math.min(a.z0, b.z0),
    z1: Math.max(a.z1, b.z1),
  };
}

export const boundsVolume = (b: Bounds) =>
  (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) * (b.z1 - b.z0 + 1);

/** Share of light a block lets through; also the UI legend source. */
export const blockTransmission = (b: Block) =>
  transmissionTable[b.material] ?? 0;
