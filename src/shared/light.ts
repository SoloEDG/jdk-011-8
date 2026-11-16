import type { Block, WorldDocument } from "./document";

/**
 * Derived light data for the current world revision. Never serialised: it is
 * rebuilt from blocks + time whenever a world is opened or edited.
 * `sky` and `torch` are 0..1 grids laid out x-fastest (see lighting/lib/grid).
 */
export interface LightField {
  sky: Float32Array;
  torch: Float32Array;
  /** World revision this field was solved from. */
  revision: number;
  /** True when only a bounded neighbourhood was re-solved. */
  approximate: boolean;
  /** Heap expansions performed by the solver. */
  visited: number;
  torches: number;
  /** Non-solid, non-torch cells with no sky access at all. */
  enclosed: number;
  /** Milliseconds spent inside solver slices. */
  elapsed: number;
}

/**
 * The lighting service a workspace carries. It schedules work across frames,
 * owns the last applied field and publishes a reactive readout.
 */
export interface LightingRuntime {
  readonly field: LightField | null;
  /** Bumped whenever the applied fields are replaced. */
  readonly version: number;
  /** Called for every edit so the next solve can target a bounded region. */
  markChanged(cells: Block[]): void;
  /** Force an exact whole-world solve (load, import, mode switch). */
  invalidate(): void;
  /** Exact, synchronous rebuild for the first frame after create/load. */
  rebuildNow(): void;
  setMode(mode: "local" | "full"): void;
  /** Advance scheduling and refresh the reactive readout. */
  tick(doc: WorldDocument, budgetMs?: number): void;
}
