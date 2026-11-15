import type { Workspace, WorldDocument } from "../../../shared/document";
import { writeWorld, readWorld, downloadWorld } from "../lib/storage";
import { decode } from "../lib/codec";
function install(s: Workspace, doc: WorldDocument) {
  const revision = s.doc.revision + 1;
  s.doc = doc;
  s.doc.revision = revision;
  s.dirty = false;
  s.mode = "build";
  s.savedAt = null;
  s.message = "世界已载入";
}
export function save(s: Workspace) {
  try {
    s.savedAt = writeWorld(s.doc);
    s.dirty = false;
    s.message = "世界已保存到此浏览器";
  } catch {
    s.message = "保存失败，请导出备份";
  }
}
export function load(s: Workspace) {
  try {
    install(s, readWorld());
  } catch (e) {
    s.message = (e as Error).message;
  }
}
export function exportWorld(s: Workspace) {
  downloadWorld(s.doc);
  s.message = "世界文件已导出";
}
export async function importWorld(s: Workspace, file: File) {
  try {
    install(s, decode(await file.text()));
  } catch (e) {
    s.message = (e as Error).message;
  }
}
