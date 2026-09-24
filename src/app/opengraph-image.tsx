import { ImageResponse } from "next/og";
import { SITE_TAGLINE } from "@/lib/site";

export const alt = `Southward: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The Crux, as on the app icon, scaled to fill the right side of the card.
const STARS = [
  [920, 500, 20],
  [790, 290, 15],
  [940, 120, 17],
  [1060, 250, 12],
  [1000, 380, 9],
];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#152640", color: "#eef2f7", padding: 80, position: "relative" }}>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0 }}>
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#e0a526" />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 680 }}>
          <div style={{ fontSize: 36, color: "#e0a526", fontWeight: 600 }}>Southward</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, marginTop: 24 }}>Your way from MBBS to practising in Australia</div>
          <div style={{ fontSize: 30, color: "#b3c0d2", marginTop: 28 }}>AMC exam prep: lessons, questions, mocks and clinical stations</div>
        </div>
      </div>
    ),
    size,
  );
}
