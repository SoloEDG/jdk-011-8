import type { WorldDocument } from "../../../shared/document";
import { encode, decode } from "./codec";
const SLOT = "blockhaven-world-v1";
export function writeWorld(doc: WorldDocument) {
  localStorage.setItem(SLOT, encode(doc));
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function readWorld() {
  const raw = localStorage.getItem(SLOT);
  if (!raw) throw Error("还没有本地存档");
  return decode(raw);
}
export function downloadWorld(doc: WorldDocument) {
  const url = URL.createObjectURL(
    new Blob([encode(doc)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.name}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
