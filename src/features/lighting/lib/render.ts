import * as THREE from "three";
import { AMBIENT } from "./daylight";
import { COUNT, D, H, W } from "./grid";
import { WORLD } from "../../../shared/document";
/**
 * A 3D texture holding the sky (R) and torch (G) light fields plus a shared
 * uniform block. Every block material samples it at the face's neighbour cell,
 * so the same field the panel reports is what the frame is shaded with.
 *
 * Time of day enters only through uniforms; changing the clock never rewrites
 * any material colour, which is what stops exposure from being mistaken for
 * albedo when a world is exported.
 */
export interface LightRig {
  texture: THREE.Data3DTexture;
  data: Uint8Array;
  uniforms: {
    uLightMap: { value: THREE.Data3DTexture };
    uLightMin: { value: THREE.Vector3 };
    uLightSize: { value: THREE.Vector3 };
    uTorchGain: { value: number };
    uAmbient: { value: number };
  };
  /** Replace the packed fields; call only when the solver publishes a new one. */
  upload(sky: Float32Array | null, torch: Float32Array | null): void;
  dispose(): void;
}

export function createLightRig(): LightRig {
  const data = new Uint8Array(COUNT * 4);
  const texture = new THREE.Data3DTexture(data, W, H, D);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  // No light data yet: treat the world as fully skylit.
  for (let i = 0; i < COUNT; i++) {
    data[i * 4] = 255;
    data[i * 4 + 3] = 255;
  }
  texture.needsUpdate = true;
  return {
    texture,
    data,
    uniforms: {
      uLightMap: { value: texture },
      uLightMin: {
        value: new THREE.Vector3(WORLD.minX, WORLD.minY, WORLD.minZ),
      },
      uLightSize: {
        value: new THREE.Vector3(W, H, D),
      },
      uTorchGain: { value: 0.72 },
      uAmbient: { value: AMBIENT },
    },
    upload(sky, torch) {
      for (let i = 0; i < COUNT; i++) {
        data[i * 4] = sky ? Math.round(sky[i] * 255) : 255;
        data[i * 4 + 1] = torch ? Math.round(torch[i] * 255) : 0;
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 255;
      }
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
    },
  };
}

const PATCH_KEY = "blockhaven-light-v1";

/**
 * Injects the light lookup into a standard material. Sampling happens at the
 * surface point offset half a cell along its own normal, i.e. in the air cell
 * the face looks into — walls read bright on their sunlit side and dark on
 * their interior side without per-face geometry.
 */
export function patchMaterial(
  material: THREE.Material,
  rig: LightRig,
) {
  const std = material as THREE.MeshStandardMaterial;
  std.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, rig.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vBhWorld;
varying vec3 vBhNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec4 bhWorld = vec4( transformed, 1.0 );
vec3 bhNormal = normal;
#ifdef USE_INSTANCING
  bhWorld = instanceMatrix * bhWorld;
  bhNormal = mat3( instanceMatrix ) * bhNormal;
#endif
bhWorld = modelMatrix * bhWorld;
vBhWorld = bhWorld.xyz;
vBhNormal = normalize( mat3( modelMatrix ) * bhNormal );`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler3D uLightMap;
uniform vec3 uLightMin;
uniform vec3 uLightSize;
uniform float uTorchGain;
uniform float uAmbient;
varying vec3 vBhWorld;
varying vec3 vBhNormal;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `vec3 bhSampleAt = vBhWorld + normalize( vBhNormal ) * 0.5;
vec3 bhUvw = ( bhSampleAt - uLightMin ) / uLightSize;
vec4 bhLight = texture( uLightMap, clamp( bhUvw, 0.0, 1.0 ) );
float bhSky = bhLight.r;
float bhTorch = bhLight.g * uTorchGain;
// The scene lights (sun, sky, moon) already carry the time-of-day curve for
// open ground, so the field is applied here as an occlusion mask: a cell with
// full sky access keeps the scene's lighting, a roofed or sealed cell does not.
// Applying the daylight curve again would darken open ground twice.
float bhLevel = max( uAmbient, max( bhSky, bhTorch ) );
outgoingLight *= mix( 0.1, 1.0, bhLevel );
// Torches emit their own warm light; sky light is left to the scene lights.
outgoingLight += diffuseColor.rgb * vec3( 1.0, 0.56, 0.26 ) * clamp( bhTorch * 0.9, 0.0, 0.9 );
#include <opaque_fragment>`,
      );
  };
  std.customProgramCacheKey = () => PATCH_KEY;
}
