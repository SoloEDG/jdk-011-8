import type { Workspace, Vec3 } from "../../../shared/document";
export function pickCorner(s: Workspace, p: Vec3) {
  if (!s.anchor) {
    s.anchor = { ...p };
    s.region = { a: { ...p }, b: { ...p } };
    s.message = "已设置起点，请选择区域终点";
  } else {
    s.region = { a: { ...s.anchor }, b: { ...p } };
    s.anchor = null;
    s.message = "区域已选择，可填充或拆除";
  }
}
export function clearRegion(s: Workspace) {
  s.anchor = null;
  s.region = null;
  s.message = "已取消区域选择";
}
