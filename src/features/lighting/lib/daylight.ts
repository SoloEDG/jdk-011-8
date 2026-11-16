import { clampTime } from "../../../shared/document";

/** Floor of the light scale so a pitch-black room is still navigable. */
export const AMBIENT = 0.045;
/** Faint blue moonlight keeps open ground navigable but interiors black. */
export const MOONLIGHT = 0.2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 0 at sunrise/sunset, rises to 1 at noon, exactly 0 all night. */
export function daylightAt(time: number) {
  const elevation = Math.sin(((clampTime(time) - 6) / 12) * Math.PI);
  if (elevation <= 0) return 0;
  return clamp01(Math.pow(elevation, 0.7));
}

/** How strongly open-sky cells are lit: full sun by day, faint moon by night. */
export function skyGainAt(daylight: number) {
  return Math.max(daylight, MOONLIGHT * (1 - daylight));
}

/** Torches matter more at night; a lit room stays readable by day too. */
export const torchGainAt = (daylight: number) => 1 - 0.28 * daylight;

/**
 * The single formula shared by renderer, character readout and any export
 * preview. Keeping it in one place is what makes “what the world looks like”
 * and “what the panel reports” agree for a given world state.
 */
export function combineLight(sky: number, torch: number, daylight: number) {
  return Math.max(
    AMBIENT,
    clamp01(sky) * skyGainAt(daylight),
    clamp01(torch) * torchGainAt(daylight),
  );
}

export interface SunState {
  daylight: number;
  /** Direction toward the sun (normalised hint, may be mostly vertical). */
  x: number;
  y: number;
  z: number;
  background: string;
  fog: string;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  /** Cool fill standing in for moonlight on open ground. */
  moonIntensity: number;
  moonColor: string;
  /** Warm cast near sunrise/sunset that also tints blocks. */
  tint: string;
}

export function sunStateAt(time: number): SunState {
  const t = clampTime(time);
  const angle = ((t - 6) / 12) * Math.PI;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const daylight = daylightAt(t);
  const night = 1 - daylight;
  const warm = daylight > 0 ? clamp01(1 - Math.abs(sin) / 0.5) : 0;
  const len = Math.hypot(cos * 0.9, Math.max(sin, 0.06), -0.35);
  return {
    daylight,
    x: (cos * 0.9) / len,
    y: Math.max(sin, 0.06) / len,
    z: -0.35 / len,
    background: mixHex(mixHex("#0a1018", "#dce5df", daylight), "#e7b085", warm * 0.5),
    fog: mixHex(mixHex("#0d1520", "#dce5df", daylight), "#dfa87d", warm * 0.45),
    sunColor: mixHex("#ffd0a0", "#fff1d5", clamp01(daylight * 1.35)),
    sunIntensity: 2.3 * daylight,
    hemiSky: mixHex("#2a3a55", "#fffae8", daylight),
    hemiGround: mixHex("#1a2330", "#779082", daylight),
    // Never fully collapse the ambient at night: moonlight grazing open ground
    // should still read as shapes, while the light field keeps interiors black.
    hemiIntensity: 0.85 + daylight * 1.45,
    /** Faint cool directional fill representing the moon. */
    moonIntensity: 0.55 * night,
    moonColor: "#9fb4e8",
    tint: mixHex("#aec0e6", "#fff6e8", daylight),
  };
}

export function phaseLabel(time: number) {
  const t = clampTime(time);
  if (t < 4.5) return "深夜";
  if (t < 6) return "黎明";
  if (t < 8) return "清晨";
  if (t < 11) return "上午";
  if (t < 13) return "正午";
  if (t < 16) return "午后";
  if (t < 18) return "黄昏";
  if (t < 20) return "入夜";
  return "夜晚";
}

export function formatClock(time: number) {
  const t = clampTime(time);
  let hours = Math.floor(t);
  let minutes = Math.round((t - hours) * 60);
  if (minutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export const isNight = (time: number) => daylightAt(time) < 0.1;
export const percent = (v: number) => `${Math.round(clamp01(v) * 100)}%`;

/** Palette-space interpolation between two #rrggbb colours. */
export function mixHex(a: string, b: string, t: number) {
  const k = clamp01(t);
  const ca = toRgb(a);
  const cb = toRgb(b);
  return `#${ca
    .map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, "0"))
    .join("")}`;
}

function toRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
