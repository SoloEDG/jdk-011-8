import * as THREE from "three";
import type { WorldDocument } from "../../../shared/document";
import { materials } from "../../../shared/materials";
import { patchMaterial, type LightRig } from "../../lighting/lib/render";

/**
 * Builds one InstancedMesh per material. Block colours come from the material
 * catalogue and are never modified by exposure or lighting — brightness is
 * applied in the shader from the live light field, so a saved/exported world
 * keeps its authored albedo.
 */
export function blockMeshes(doc: WorldDocument, rig: LightRig) {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  for (const spec of materials) {
    const blocks = Object.values(doc.blocks).filter(
      (b) => b.material === spec.id,
    );
    if (!blocks.length) continue;
    const material = new THREE.MeshStandardMaterial({
      // Factors only; never written back into the document.
      color: new THREE.Color(spec.color),
      roughness: spec.emitsLight ? 1 : 0.92,
      metalness: 0,
      transparent: spec.alpha < 1,
      opacity: spec.alpha,
      emissive: spec.emitsLight ? new THREE.Color("#ff9d3a") : new THREE.Color("#000000"),
      emissiveIntensity: spec.emitsLight ? 0.9 : 0,
    });
    if (spec.emitsLight) material.toneMapped = true;
    patchMaterial(material, rig);
    const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
    const matrix = new THREE.Matrix4();
    blocks.forEach((b, i) => {
      const size = spec.emitsLight ? 0.26 : 1;
      matrix.makeScale(size, spec.emitsLight ? 0.62 : 1, size);
      matrix.setPosition(b.x + 0.5, b.y + (spec.emitsLight ? 0.31 : 0.5), b.z + 0.5);
      mesh.setMatrixAt(i, matrix);
      // A tiny deterministic shade variation keeps large flat walls readable.
      // It multiplies the instance colour, not the document's material colour.
      const shade = 0.92 + ((b.x * 13 + b.z * 7 + b.y * 3) % 7) * 0.012;
      mesh.setColorAt(i, new THREE.Color().setScalar(shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.cells = blocks;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function disposeGroup(group: THREE.Group) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => m.dispose());
    }
  });
}
