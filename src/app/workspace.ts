import { reactive } from "vue";
import type { Workspace, Tool, MaterialId } from "../shared/document";
import type { SceneHit } from "../shared/commands";
import { createWorld, editCells } from "../features/world";
import { pickCorner, regionCells, clearRegion } from "../features/selection";
import { chooseMaterial, selectSlot } from "../features/inventory";
export function createWorkspace() {
  return reactive<Workspace>({
    doc: createWorld(),
    material: "grass",
    tool: "place",
    region: null,
    anchor: null,
    message: "欢迎来到方屿，开始建造你的世界",
    dirty: false,
    mode: "build",
    savedAt: null,
  });
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
      else
        s.message = editCells(
          s,
          [s.tool === "place" ? h.adjacent : h.cell],
          s.tool === "remove",
        ).message;
    },
    region(remove = false) {
      if (s.region)
        s.message = editCells(s, regionCells(s.region), remove).message;
    },
    clear() {
      clearRegion(s);
    },
    toggle() {
      s.mode = s.mode === "build" ? "walk" : "build";
    },
    key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).matches("input,textarea") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (/^[1-8]$/.test(e.key)) selectSlot(s, Number(e.key) - 1);
      if (e.code === "KeyB") s.tool = "place";
      if (e.code === "KeyE") s.tool = "remove";
      if (e.code === "KeyR") s.tool = "select";
      if (e.code === "Escape") clearRegion(s);
      if (e.code === "Tab") {
        e.preventDefault();
        s.mode = s.mode === "build" ? "walk" : "build";
      }
    },
  };
}
