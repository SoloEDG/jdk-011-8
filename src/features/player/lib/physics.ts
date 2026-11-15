import type { Workspace } from "../../../shared/document";
import { collides } from "./collision";
export interface Motion {
  vertical: number;
  grounded: boolean;
}
export function stepPlayer(
  s: Workspace,
  keys: Set<string>,
  motion: Motion,
  dt: number,
) {
  if (s.mode !== "walk") return;
  const p = s.doc.player;
  const speed = 4 * dt;
  let dx = (Number(keys.has("KeyD")) - Number(keys.has("KeyA"))) * speed,
    dz = (Number(keys.has("KeyS")) - Number(keys.has("KeyW"))) * speed;
  if (dx && dz) {
    dx /= Math.SQRT2;
    dz /= Math.SQRT2;
  }
  for (const [axis, amount] of [
    ["x", dx],
    ["z", dz],
  ] as const) {
    const next = { ...p, [axis]: p[axis] + amount };
    if (
      Math.abs(next.x) < 15 &&
      Math.abs(next.z) < 15 &&
      !collides(s.doc, next)
    )
      p[axis] = next[axis];
  }
  if (keys.has("Space") && motion.grounded) {
    motion.vertical = 6;
    motion.grounded = false;
  }
  motion.vertical -= 18 * dt;
  const next = { ...p, y: p.y + motion.vertical * dt };
  if (collides(s.doc, next)) {
    motion.grounded = motion.vertical < 0;
    motion.vertical = 0;
  } else {
    p.y = next.y;
    motion.grounded = false;
  }
  if (p.y < -5) {
    Object.assign(p, { x: 0, y: 12, z: 9 });
    motion.vertical = 0;
  }
  s.dirty = true;
}
