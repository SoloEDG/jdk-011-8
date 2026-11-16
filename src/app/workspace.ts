import { reactive } from "vue";
import {
  clampTime,
  type Workspace,
  type Tool,
  type MaterialId,
  type LightingMode,
} from "../shared/document";
import type { SceneHit } from "../shared/commands";
import { createWorld, editCells } from "../features/world";
import { pickCorner, regionCells, clearRegion } from "../features/selection";
import { chooseMaterial, selectSlot } from "../features/inventory";
import {
  createLightingRuntime,
  initialLightingView,
  lightingFor,
} from "../features/lighting";

export function createWorkspace() {
  const s = reactive<Workspace>({
    doc: createWorld(),
    material: "grass",
    tool: "place",
    region: null,
    anchor: null,
    message: "欢迎来到方屿，开始建造你的世界",
    dirty: false,
    mode: "build",
    savedAt: null,
    clockPlaying: false,
    lighting: initialLightingView(),
  });
  // Derived light state lives outside the document; it is rebuilt from blocks
  // and the clock, never saved, and never written back into materials.
  createLightingRuntime(s).rebuildNow();
  return s;
}

/**
 * Applies an edit and tells the light runtime which cells changed, so it can
 * choose between a bounded local re-solve and a full propagation.
 */
function applyEdit(s: Workspace, cells: Parameters<typeof editCells>[1], remove: boolean) {
  const result = editCells(s, cells, remove);
  if (result.changed.length) lightingFor(s).markChanged(result.changed);
  s.message = result.message;
  return result;
}

export function commandRouter(s: Workspace) {
  return {
    tool(t: Tool) {
      s.tool = t;
      s.mode = "build";
    },
    material(id: MaterialId) {
      chooseMaterial(s, id);
    },
    hit(h: SceneHit) {
      if (s.tool === "select") pickCorner(s, h.cell);
      else applyEdit(s, [s.tool === "place" ? h.adjacent : h.cell], s.tool === "remove");
    },
    region(remove = false) {
      if (s.region) applyEdit(s, regionCells(s.region), remove);
    },
    clear() {
      clearRegion(s);
    },
    toggle() {
      s.mode = s.mode === "build" ? "walk" : "build";
    },
    setTime(hours: number) {
      s.doc.time = clampTime(hours);
      // Only the clock changed; the light field is still valid, so nothing is
      // re-solved. Brightness changes come from the shared daylight formula.
      s.message = `时间调至 ${String(Math.floor(s.doc.time)).padStart(2, "0")}:${String(
        Math.round((s.doc.time % 1) * 60),
      ).padStart(2, "0")}`;
    },
    toggleClock() {
      s.clockPlaying = !s.clockPlaying;
      s.message = s.clockPlaying ? "时间开始流动" : "时间已暂停";
    },
    lightingMode(mode: LightingMode) {
      lightingFor(s).setMode(mode);
      s.message =
        mode === "local"
          ? "局部光照：编辑后只重算附近区域"
          : "完整光照：重算整个世界的传播";
    },
    fullSolve() {
      lightingFor(s).setMode("full");
      s.message = "正在完整重算光照";
    },
    key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).matches("input,textarea") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (/^[1-9]$/.test(e.key)) selectSlot(s, Number(e.key) - 1);
      if (e.code === "KeyB") s.tool = "place";
      if (e.code === "KeyE") s.tool = "remove";
      if (e.code === "KeyR") s.tool = "select";
      if (e.code === "Escape") clearRegion(s);
      if (e.code === "KeyT") s.clockPlaying = !s.clockPlaying;
      if (e.code === "Tab") {
        e.preventDefault();
        s.mode = s.mode === "build" ? "walk" : "build";
      }
    },
  };
}
