import { D, H, SX, SY, SZ, W } from "./grid";

export type FloodMode = "sky" | "torch";

export interface Bounds {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

/** Light value pushed back into a local window from its boundary. */
export interface IncomingSeed {
  i: number;
  v: number;
}

export interface FloodOptions {
  trans: Float32Array;
  mode: FloodMode;
  /** Written in place. Cells outside `bounds` are never touched. */
  field: Float32Array;
  /** null = whole volume. */
  bounds: Bounds | null;
  torchCells: Int32Array;
  /** Boundary light carried in from outside a local window. */
  incoming?: IncomingSeed[];
}

/** Direction used to pick how much attenuation applies. */
type Dir = "down" | "side" | "up";

/** Torch light loses 24% per cell. */
export const TORCH_ATTENUATION = 0.76;
/** Sky light loses 14% moving sideways; straight down does not decay. */
export const SKY_ATTENUATION = 0.86;
/** Sky light rising upwards is dimmer, so eaves are not over-bright. */
export const SKY_UP_ATTENUATION = 0.62;
/** Below this a contribution is negligible and dropped. */
export const CUTOFF = 0.015;

export interface FloodJob {
  readonly done: boolean;
  /** Pops at most `budget` heap entries; returns expansions performed. */
  step(budget: number): number;
  readonly visited: number;
}

interface Item {
  i: number;
  v: number;
}

/**
 * A resumable, bounded light flood. Work is sliced by a pop budget so large
 * solves never block frame-to-frame building input.
 */
export function createFlood(opts: FloodOptions): FloodJob {
  const heap = new MaxHeap();
  let visited = 0;
  let seeded = false;

  const within = (i: number) => {
    const b = opts.bounds;
    if (!b) return true;
    const x = i % W;
    const y = Math.floor(i / SY) % H;
    const z = Math.floor(i / SZ);
    return (
      x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1
    );
  };

  const decay = (v: number, trans: number, dir: Dir) => {
    if (trans <= 0) return 0;
    if (opts.mode === "torch") return v * trans * TORCH_ATTENUATION;
    if (dir === "side") return v * trans * SKY_ATTENUATION;
    if (dir === "down") return v * trans;
    return v * trans * SKY_UP_ATTENUATION;
  };

  const relax = (j: number, v: number, dir: Dir) => {
    if (!within(j)) return;
    const lit = decay(v, opts.trans[j], dir);
    if (lit < CUTOFF) return;
    if (lit <= opts.field[j] + 1e-6) return;
    opts.field[j] = lit;
    heap.push(j, lit);
  };

  const seed = () => {
    if (opts.mode === "sky") {
      for (let z = 0; z < D; z++)
        for (let x = 0; x < W; x++) {
          const i = (H - 1) * SY + z * SZ + x;
          if (!within(i) || opts.trans[i] <= 0) continue;
          if (opts.field[i] < 1) {
            opts.field[i] = 1;
            heap.push(i, 1);
          }
        }
    } else {
      for (let n = 0; n < opts.torchCells.length; n++) {
        const i = opts.torchCells[n];
        if (!within(i) || opts.trans[i] <= 0) continue;
        if (opts.field[i] >= 1) continue;
        opts.field[i] = 1;
        heap.push(i, 1);
      }
    }
    // Boundary light from outside a local window re-enters at the level it
    // already had, so local solving invents no shadow ring at the edge.
    if (opts.incoming)
      for (const s of opts.incoming) {
        if (!within(s.i) || opts.trans[s.i] <= 0) continue;
        if (s.v <= opts.field[s.i] + 1e-6) continue;
        opts.field[s.i] = s.v;
        heap.push(s.i, s.v);
      }
  };

  return {
    get done() {
      return seeded && heap.size === 0;
    },
    get visited() {
      return visited;
    },
    step(budget: number) {
      if (!seeded) {
        seed();
        seeded = true;
      }
      let popped = 0;
      while (heap.size > 0 && popped < budget) {
        const { i, v } = heap.pop()!;
        popped++;
        visited++;
        // A brighter value may have been pushed for the same cell since.
        if (v + 1e-6 < opts.field[i]) continue;
        const x = i % W;
        const y = Math.floor(i / SY) % H;
        const z = Math.floor(i / SZ);
        if (x > 0) relax(i - SX, v, "side");
        if (x < W - 1) relax(i + SX, v, "side");
        if (y > 0) relax(i - SY, v, "down");
        if (y < H - 1) relax(i + SY, v, "up");
        if (z > 0) relax(i - SZ, v, "side");
        if (z < D - 1) relax(i + SZ, v, "side");
      }
      return popped;
    },
  };
}

/** Non-solid, non-torch cells with effectively no sky light (sealed rooms). */
export function countEnclosed(
  trans: Float32Array,
  sky: Float32Array,
  torchCells: Int32Array,
) {
  const torches = new Set<number>();
  for (let i = 0; i < torchCells.length; i++) torches.add(torchCells[i]);
  let n = 0;
  for (let i = 0; i < trans.length; i++)
    if (trans[i] > 0 && !torches.has(i) && sky[i] < 0.02) n++;
  return n;
}

/** Max-heap on light value. */
class MaxHeap {
  private items: Item[] = [];
  get size() {
    return this.items.length;
  }
  push(i: number, v: number) {
    const a = this.items;
    a.push({ i, v });
    let n = a.length - 1;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (a[p].v >= a[n].v) break;
      [a[p], a[n]] = [a[n], a[p]];
      n = p;
    }
  }
  pop(): Item | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let n = 0;
      for (;;) {
        const l = n * 2 + 1;
        const r = l + 1;
        let best = n;
        if (l < a.length && a[l].v > a[best].v) best = l;
        if (r < a.length && a[r].v > a[best].v) best = r;
        if (best === n) break;
        [a[best], a[n]] = [a[n], a[best]];
        n = best;
      }
    }
    return top;
  }
}
