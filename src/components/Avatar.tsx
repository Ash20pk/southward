import clsx from "clsx";

export type AvatarLook = {
  sex: "male" | "female";
  age: number;
  skin: string;
  hair: string;
  style: "crop" | "side" | "receding" | "long" | "bob" | "bun";
  glasses?: boolean;
  brows?: "calm" | "worried" | "cross";
};

const SKIN = ["#f5d6bc", "#ebc29e", "#d6a077", "#b07a50", "#835233", "#5e3a23"];
const HAIR = ["#1d1815", "#36261c", "#5e3d25", "#8f5e34", "#c99a58"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A look for a role-player, steady for a given name, so the same patient always looks the same. */
export function lookFor(p: { name: string; age: number; sex: "male" | "female"; persona?: string }): AvatarLook {
  const h = hash(p.name);
  const hair = p.age >= 68 ? "#d9d6d0" : p.age >= 52 ? "#8d847b" : HAIR[(h >>> 3) % HAIR.length];
  const style: AvatarLook["style"] =
    p.sex === "female"
      ? (["long", "bob", "bun"] as const)[(h >>> 6) % 3]
      : p.age >= 55 && (h >>> 6) % 2 === 0
        ? "receding"
        : (["crop", "side"] as const)[(h >>> 6) % 2];
  const persona = p.persona ?? "";
  const brows = /angry|frustrat|irritat|demanding|hostile/i.test(persona)
    ? "cross"
    : /anxious|worried|scared|frighten|distress|upset|tearful|teary|panick/i.test(persona)
      ? "worried"
      : "calm";
  return { sex: p.sex, age: p.age, skin: SKIN[h % SKIN.length], hair, style, glasses: p.age >= 55 && (h >>> 9) % 3 !== 0, brows };
}

/** The candidate's own doctor, picked on the station brief. */
export const DOCTORS: AvatarLook[] = [
  { sex: "female", age: 32, skin: SKIN[2], hair: HAIR[0], style: "bun" },
  { sex: "male", age: 34, skin: SKIN[3], hair: HAIR[0], style: "side" },
  { sex: "female", age: 30, skin: SKIN[0], hair: HAIR[3], style: "bob" },
  { sex: "male", age: 36, skin: SKIN[1], hair: HAIR[2], style: "crop", glasses: true },
];

const ink = "#2a1d17";

/**
 * A head-and-shoulders portrait in plain SVG. It blinks, and while `speaking` its mouth moves and its head nods;
 * the animation is CSS (globals.css, .av-*), so it stops for anyone who asks for reduced motion.
 */
export function Avatar({
  look,
  doctor,
  speaking,
  listening,
  className,
}: {
  look: AvatarLook;
  doctor?: boolean;
  speaking?: boolean;
  listening?: boolean;
  className?: string;
}) {
  const { skin, hair, style } = look;
  const old = look.age >= 62;
  const shirt = doctor ? "#f4f6f8" : ["#3f6e8c", "#8c4f5e", "#5d7a4a", "#7b6a9a", "#a7743a"][hash(skin + hair + style) % 5];
  const browY = 79;
  const brow = (x: number, side: 1 | -1) => {
    // side: 1 for the left brow, -1 for the right; worried lifts the inner end, cross drops it.
    const inner = look.brows === "worried" ? -4 : look.brows === "cross" ? 3 : 0;
    const x1 = x - 7 * side;
    const x2 = x + 7 * side;
    return <path d={`M${x1},${browY} Q${x},${browY - 3} ${x2},${browY + inner}`} stroke={hair === "#d9d6d0" ? "#a8a29a" : hair} strokeWidth="3.4" strokeLinecap="round" fill="none" />;
  };

  return (
    <svg viewBox="0 0 200 200" className={clsx("overflow-hidden rounded-full", className)} aria-hidden>
      <circle cx="100" cy="100" r="100" fill={doctor ? "var(--brand-soft)" : "var(--ochre-soft)"} />
      <g className={clsx(speaking && "av-head-talk")}>
        {/* Long hair falls behind the shoulders */}
        {style === "long" && <path d="M56,92 C52,40 148,40 144,92 L150,156 C128,166 72,166 50,156 Z" fill={hair} />}

        {/* Shoulders and clothes */}
        <path d="M24,200 C28,160 60,144 100,144 C140,144 172,160 176,200 Z" fill={shirt} />
        {doctor ? (
          <>
            <path d="M82,145 L100,178 L118,145 Z" fill="#4f8fae" />
            <path d="M82,145 L100,178 M118,145 L100,178" stroke="#c9d1d9" strokeWidth="3" />
            <path d="M78,150 C70,176 84,190 100,188" stroke="#3a4552" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M122,150 C128,170 124,180 118,186" stroke="#3a4552" strokeWidth="4" fill="none" strokeLinecap="round" />
            <circle cx="117" cy="190" r="6" fill="#9aa6b4" stroke="#3a4552" strokeWidth="3" />
            <rect x="128" y="168" width="22" height="13" rx="3" fill="var(--brand)" />
          </>
        ) : (
          <path d="M84,146 C88,158 112,158 116,146" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="4" />
        )}

        {/* Neck, ears, head */}
        <rect x="87" y="116" width="26" height="34" rx="11" fill={skin} />
        <rect x="87" y="128" width="26" height="8" fill="rgba(0,0,0,0.08)" />
        <ellipse cx="64" cy="94" rx="6.5" ry="9.5" fill={skin} />
        <ellipse cx="136" cy="94" rx="6.5" ry="9.5" fill={skin} />
        <ellipse cx="100" cy="90" rx="36" ry="42" fill={skin} />

        {/* Hair on top */}
        {style === "crop" && <path d="M64,86 C60,50 82,42 100,42 C120,42 142,52 136,86 C132,70 120,62 100,62 C82,62 68,70 64,86 Z" fill={hair} />}
        {style === "side" && <path d="M64,90 C58,48 86,40 104,42 C126,44 144,56 136,90 C134,74 128,64 116,60 C100,66 80,64 70,70 C66,76 65,82 64,90 Z" fill={hair} />}
        {style === "receding" && (
          <>
            <path d="M63,96 C61,80 64,70 72,64 L74,84 Z" fill={hair} />
            <path d="M137,96 C139,80 136,70 128,64 L126,84 Z" fill={hair} />
          </>
        )}
        {(style === "long" || style === "bob") && <path d="M62,96 C58,46 90,40 104,42 C128,44 146,62 138,96 C132,76 116,64 96,62 C82,68 70,80 62,96 Z" fill={hair} />}
        {style === "bob" && (
          <>
            <path d="M62,92 C58,112 60,124 70,130 L72,96 Z" fill={hair} />
            <path d="M138,92 C142,112 140,124 130,130 L128,96 Z" fill={hair} />
          </>
        )}
        {style === "bun" && (
          <>
            <circle cx="100" cy="40" r="15" fill={hair} />
            <path d="M64,88 C60,50 84,44 100,44 C118,44 142,52 136,88 C130,70 118,62 100,62 C82,62 70,70 64,88 Z" fill={hair} />
          </>
        )}

        {/* Face */}
        {brow(86, 1)}
        {brow(114, -1)}
        <g className="av-eyes">
          <circle cx="86" cy="91" r="3.8" fill={ink} />
          <circle cx="114" cy="91" r="3.8" fill={ink} />
        </g>
        {look.glasses && (
          <g fill="none" stroke="#3a3330" strokeWidth="2.6">
            <rect x="74" y="83" width="23" height="17" rx="6" />
            <rect x="103" y="83" width="23" height="17" rx="6" />
            <path d="M97,90 L103,90" />
          </g>
        )}
        {old && (
          <g stroke="rgba(0,0,0,0.22)" strokeWidth="1.6" fill="none" strokeLinecap="round">
            <path d="M88,64 Q100,61 112,64" />
            <path d="M68,92 L72,95 M132,92 L128,95" />
            <path d="M82,112 Q84,118 87,120 M118,112 Q116,118 113,120" />
          </g>
        )}
        <path d="M100,95 C98,103 96,107 102,108" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="78" cy="106" rx="6" ry="3.5" fill="#e0786a" opacity="0.22" />
        <ellipse cx="122" cy="106" rx="6" ry="3.5" fill="#e0786a" opacity="0.22" />
        {speaking ? (
          <g className="av-mouth">
            <ellipse cx="100" cy="117" rx="8" ry="5.5" fill="#6b2a2a" />
            <path d="M93,114.5 Q100,113 107,114.5" stroke="#fff" strokeWidth="1.8" fill="none" opacity="0.8" />
          </g>
        ) : (
          <path
            d={look.brows === "worried" || look.brows === "cross" ? "M91,118 Q100,115 109,118" : listening ? "M93,116 Q100,120 107,116" : "M90,115 Q100,122 110,115"}
            stroke="#6b2a2a"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>
    </svg>
  );
}
