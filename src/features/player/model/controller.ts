import type { Workspace } from "../../../shared/document";
import { stepPlayer, type Motion } from "../lib/physics";
export function attachPlayer(s: Workspace) {
  const keys = new Set<string>();
  const motion: Motion = { vertical: 0, grounded: false };
  const down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).matches("input,textarea")) return;
    if (
      ["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code) &&
      s.mode === "walk"
    ) {
      e.preventDefault();
      keys.add(e.code);
    }
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  let prev = performance.now(),
    id = 0;
  function tick(now: number) {
    const dt = Math.min((now - prev) / 1000, 0.04);
    prev = now;
    stepPlayer(s, keys, motion, dt);
    id = requestAnimationFrame(tick);
  }
  id = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(id);
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}
