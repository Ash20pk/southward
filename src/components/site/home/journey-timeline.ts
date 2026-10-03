/**
 * When each part of the journey happens, as fractions of the way through its scroll (five screens). Shared by the
 * WebGL scene and the words over it, so they stay in step.
 */
export const STAGES = {
  /** The logo lifts away. */
  logoOut: [0.037, 0.12],
  /** The globe rises into view, New Delhi facing you. */
  rise: [0.074, 0.24],
  /** The flight, India to the middle of Australia. */
  flight: [0.258, 0.662],
  /** Landing: the camera dives in on the landing while Australia warms to gold. */
  land: [0.662, 0.773],
  /** The dive ends in black. */
  black: [0.727, 0.782],
  /** "Welcome to Australia." on the black, then the mascot says hello. */
  arrive: [0.782, 0.837],
  /**
   * The last three fifths of a screen: the welcome lifts away and the mascot sets off for the roadmap (MascotHandoff),
   * while the roadmap, which overlaps the journey's end, comes in over the black (Roadmap.tsx).
   */
  handoff: [0.88, 1],
} as const satisfies Record<string, readonly [number, number]>;

/** 0 before a, 1 after b, linear between. */
export const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

/** Smoothstep: eases in and out. */
export const ease = (t: number) => t * t * (3 - 2 * t);
