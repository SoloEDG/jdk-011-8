import { WORLD } from "../../../shared/document";
import { D, H, SX, SY, SZ, W } from "./grid";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Bilinear sample of a light grid at a world position. x/z are interpolated so
 * the brightness the player reads changes continuously while walking; y uses
 * nearest-layer sampling because light changes sharply between floor and
 * ceiling. Grid layout: index = z * SZ + y * SY + x.
 */
export function sampleField(
  field: Float32Array,
  x: number,
  y: number,
  z: number,
) {
  const fx = clamp(x - WORLD.minX - 0.5, 0, W - 1);
  const fz = clamp(z - WORLD.minZ - 0.5, 0, D - 1);
  const layer = clamp(Math.round(y - WORLD.minY - 0.5), 0, H - 1);

  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, W - 1);
  const z1 = Math.min(z0 + 1, D - 1);
  const tx = fx - x0;
  const tz = fz - z0;

  const row = layer * SY;
  const a0 = field[row + z0 * SZ + x0 * SX];
  const a1 = field[row + z0 * SZ + x1 * SX];
  const b0 = field[row + z1 * SZ + x0 * SX];
  const b1 = field[row + z1 * SZ + x1 * SX];
  const near = a0 + (a1 - a0) * tx;
  const far = b0 + (b1 - b0) * tx;
  return near + (far - near) * tz;
}
