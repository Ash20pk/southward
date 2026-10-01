import clsx from "clsx";

export type MascotMood = "happy" | "wow" | "wink";

/**
 * Southward's guide: a round pocket compass with a face. Its needle is its nose and always points south.
 * Plain SVG, so it works in the website and the app alike; the blink, bob and wave are CSS (see globals.css).
 */
export function Mascot({
  mood = "happy",
  wave = false,
  walking = false,
  tilt = 0,
  className,
  title,
}: {
  mood?: MascotMood;
  /** Raises a little arm and waves it. */
  wave?: boolean;
  /** Steps its feet and sways, for when it's walking somewhere. */
  walking?: boolean;
  /** Leans the whole compass, in degrees (or set --mascot-tilt on a parent). The needle stays pointing south. */
  tilt?: number;
  className?: string;
  /** Accessible name; decorative when omitted. */
  title?: string;
}) {
  const ink = "#0b1220";
  const brass = "#ead3a2";
  // Limbs are brass with a navy edge: a wide navy stroke under a narrower brass one, so they read on the night sky
  // and on paper alike.
  const limb = (d: string, key?: string) => (
    <g key={key}>
      <path d={d} fill="none" stroke={ink} strokeWidth="15" strokeLinecap="round" />
      <path d={d} fill="none" stroke={brass} strokeWidth="8" strokeLinecap="round" />
    </g>
  );
  return (
    <svg
      viewBox="0 0 220 240"
      className={clsx("mascot mascot-bob overflow-visible", walking && "mascot-walking", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g>
        <g className="mascot-sway" style={{ transformOrigin: "110px 230px" }}>
        <g style={{ transform: `rotate(var(--mascot-tilt, ${tilt}deg))`, transformOrigin: "110px 130px", transition: "transform 0.6s cubic-bezier(0.3, 1.6, 0.5, 1)" }}>
          {/* Feet */}
          <ellipse className="mascot-foot-l" cx="84" cy="222" rx="17" ry="9" fill={brass} stroke={ink} strokeWidth="5" />
          <ellipse className="mascot-foot-r" cx="136" cy="222" rx="17" ry="9" fill={brass} stroke={ink} strokeWidth="5" />

          {/* The arm: resting, or up and waving */}
          {wave ? (
            <g className="mascot-wave" style={{ transformOrigin: "186px 128px" }}>
              {limb("M186,128 C200,112 206,96 204,82")}
              <circle cx="204" cy="76" r="10" fill={brass} stroke={ink} strokeWidth="5" />
            </g>
          ) : (
            limb("M188,140 C200,150 202,164 196,172")
          )}
          {limb("M32,140 C20,150 18,164 24,172")}

          {/* Hanging loop and crown, like a pocket watch */}
          <circle cx="110" cy="22" r="13" fill="none" stroke={ink} strokeWidth="13" />
          <circle cx="110" cy="22" r="13" fill="none" stroke={brass} strokeWidth="6" />
          <rect x="96" y="30" width="28" height="18" rx="6" fill={brass} stroke={ink} strokeWidth="5" />

          {/* Brass case, with a highlight */}
          <circle cx="110" cy="132" r="84" fill="var(--ochre)" stroke={ink} strokeWidth="6" />
          <path d="M52,96 A70,70 0 0,1 104,58" fill="none" stroke="#f6e8c8" strokeWidth="8" strokeLinecap="round" />

          {/* Glass face */}
          <circle cx="110" cy="134" r="64" fill="#f3f5f9" stroke={ink} strokeWidth="5" />
          {Array.from({ length: 16 }, (_, i) => (
            <line
              key={i}
              x1="110"
              y1="76"
              x2="110"
              y2={i % 4 === 0 ? 86 : 82}
              stroke={ink}
              strokeOpacity={i % 4 === 0 ? 0.45 : 0.2}
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${i * 22.5} 110 134)`}
            />
          ))}
          <text x="110" y="104" textAnchor="middle" fontSize="15" fontWeight="700" fill={ink} fillOpacity="0.5" className="font-sans">
            N
          </text>

          {/* Cheeks */}
          <ellipse cx="68" cy="146" rx="11" ry="7" fill="#e9a8a2" opacity="0.4" />
          <ellipse cx="152" cy="146" rx="11" ry="7" fill="#e9a8a2" opacity="0.4" />

          {/* Eyes */}
          <Eye cx={80} cy={124} closed={false} ink={ink} wow={mood === "wow"} />
          <Eye cx={140} cy={124} closed={mood === "wink"} ink={ink} wow={mood === "wow"} />

          {/* Mouth */}
          {mood === "wow" ? (
            <ellipse cx="110" cy="176" rx="7" ry="8" fill={ink} />
          ) : (
            <path d="M96,172 Q110,184 124,172" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          )}
        </g>

        {/* The needle-nose: outside the tilt, so it always points south */}
        <g transform="translate(110 138)">
          <path d="M-8,0 L0,-20 L8,0Z" fill={ink} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M-8,0 L0,26 L8,0Z" fill="#c9674a" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <circle r="4" fill={brass} stroke={ink} strokeWidth="2.5" />
        </g>
        </g>
      </g>
    </svg>
  );
}

function Eye({ cx, cy, closed, ink, wow }: { cx: number; cy: number; closed: boolean; ink: string; wow: boolean }) {
  if (closed) return <path d={`M${cx - 10},${cy} Q${cx},${cy + 8} ${cx + 10},${cy}`} fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />;
  return (
    <g className="mascot-blink" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <ellipse cx={cx} cy={cy} rx={wow ? 10 : 8.5} ry={wow ? 13 : 11.5} fill={ink} />
      <circle cx={cx + 3} cy={cy - 4} r="3.2" fill="#fff" />
    </g>
  );
}
