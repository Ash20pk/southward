/**
 * When each part of the journey happens, as fractions of the way through its scroll. Shared by the WebGL scene and
 * the words over it, so they stay in step.
 */
export const STAGES = {
  /** The logo lifts away. */
  logoOut: [0.04, 0.13],
  /** The globe rises into view, New Delhi facing you. */
  rise: [0.08, 0.26],
  /** The flight, India to the middle of Australia. */
  flight: [0.28, 0.72],
  /** Landing: the camera dives in on the landing while Australia warms to gold. */
  land: [0.72, 0.84],
  /** The dive ends in black. */
  black: [0.79, 0.85],
  /** "Welcome to Australia." on the black, then the mascot says hello. */
  arrive: [0.85, 0.91],
  /** The welcome lifts away and the mascot sets off for the roadmap (MascotHandoff). */
  handoff: [0.95, 1],
} as const satisfies Record<string, readonly [number, number]>;

/** 0 before a, 1 after b, linear between. */
export const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

/** Smoothstep: eases in and out. */
export const ease = (t: number) => t * t * (3 - 2 * t);
