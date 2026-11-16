import type { Workspace, WorldDocument } from "../../../shared/document";
import { writeWorld, readWorld, downloadWorld } from "../lib/storage";
import { decode, stripBakedLighting } from "../lib/codec";
import { lightingFor } from "../../lighting";

function install(s: Workspace, doc: WorldDocument) {
  stripBakedLighting(doc);
  // Revision is monotonic across installs so viewport caches (meshes and the
  // light texture) and any in-flight solver job all see a change and rebuild.
  // The light field itself is derived, so none of it lives in the document.
  const revision = Math.max(s.doc.revision, doc.revision) + 1;
  doc.revision = revision;
  s.doc = doc;
  s.dirty = false;
  s.mode = "build";
  s.savedAt = null;
  s.message = "世界已载入，光照重新计算中";
  lightingFor(s).invalidate();
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
