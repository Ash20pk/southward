// Generates the app icon (SVG master) and every PNG size the web app manifest, iOS and Android need,
// plus iOS launch (splash) images. Run with: node scripts/make-icons.mjs (needs Playwright).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const NAVY = "#152640";
const NAVY_2 = "#1f3354";
const OCHRE = "#e0a526";
const PAPER = "#eef2f7";

// Crux, as on the dashboard constellation (viewBox 280 x 300), with each star's relative size.
const CRUX = [
  [132, 262, 9],
  [58, 138, 7.5],
  [150, 28, 8],
  [222, 118, 6],
  [190, 190, 4.5],
];

const sparkle = (cx, cy, r) => {
  const k = r * 0.28;
  return `M${cx},${cy - r * 1.6} Q${cx + k},${cy - k} ${cx + r * 1.6},${cy} Q${cx + k},${cy + k} ${cx},${cy + r * 1.6} Q${cx - k},${cy + k} ${cx - r * 1.6},${cy} Q${cx - k},${cy - k} ${cx},${cy - r * 1.6}Z`;
};

/** The mark: stars fitted into a square of `size`, occupying `fill` of it (smaller for maskable icons). */
function mark(size, fill) {
  const scale = (size * fill) / 300;
  const ox = (size - 280 * scale) / 2;
  const oy = (size - 300 * scale) / 2;
  const at = (i) => [ox + CRUX[i][0] * scale, oy + CRUX[i][1] * scale];
  // Faint cross lines (head to foot, left arm to right arm) so the constellation reads at small sizes.
  const line = (i, j) => `<line x1="${at(i)[0]}" y1="${at(i)[1]}" x2="${at(j)[0]}" y2="${at(j)[1]}" stroke="${OCHRE}" stroke-opacity="0.28" stroke-width="${size * 0.012}" stroke-linecap="round"/>`;
  const stars = CRUX.map(([x, y, r]) => {
    const cx = ox + x * scale, cy = oy + y * scale, rr = r * scale * 2.1;
    return `<circle cx="${cx}" cy="${cy}" r="${rr * 2.1}" fill="url(#g)"/><path d="${sparkle(cx, cy, rr)}" fill="${OCHRE}"/>`;
  }).join("");
  return line(2, 0) + line(1, 3) + stars;
}

function iconSvg(size, { rounded = true, fill = 0.72 } = {}) {
  const rx = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<defs><radialGradient id="g"><stop offset="0" stop-color="${OCHRE}" stop-opacity="0.55"/><stop offset="1" stop-color="${OCHRE}" stop-opacity="0"/></radialGradient>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY_2}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
<rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>${mark(size, fill)}</svg>`;
}

function splashHtml(w, h) {
  const s = Math.min(w, h) * 0.34;
  return `<html><body style="margin:0;width:${w}px;height:${h}px;background:${NAVY};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${s * 0.18}px;font-family:-apple-system,Helvetica,Arial,sans-serif">
${iconSvg(Math.round(s), { rounded: true, fill: 0.72 }).replace("<svg ", `<svg style="filter:drop-shadow(0 ${s * 0.04}px ${s * 0.12}px rgba(0,0,0,.35))" `)}
<div style="color:${PAPER};font-size:${s * 0.2}px;font-weight:600;letter-spacing:-0.01em">Southward</div>
<div style="color:#b3c0d2;font-size:${s * 0.085}px">Your way to the AMC</div></body></html>`;
}

// Master SVGs: favicon (Next.js app/icon.svg) and a copy in public.
fs.writeFileSync(path.join(root, "src/app/icon.svg"), iconSvg(64, { fill: 0.78 }));
fs.writeFileSync(path.join(root, "public/icons/icon.svg"), iconSvg(512));

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator("svg").screenshot({ path: out, omitBackground: true });
}
await png(iconSvg(192), 192, path.join(root, "public/icons/icon-192.png"));
await png(iconSvg(512), 512, path.join(root, "public/icons/icon-512.png"));
// Maskable: full-bleed background, mark inside the central safe zone.
await png(iconSvg(512, { rounded: false, fill: 0.56 }), 512, path.join(root, "public/icons/icon-maskable-512.png"));
await png(iconSvg(192, { rounded: false, fill: 0.56 }), 192, path.join(root, "public/icons/icon-maskable-192.png"));
// iOS home screen icon: square, no transparency (iOS rounds it).
await png(iconSvg(180, { rounded: false, fill: 0.7 }), 180, path.join(root, "src/app/apple-icon.png"));

// iOS launch images (portrait, device pixels). iOS picks one by media query; Android builds its own from the manifest.
export const SPLASH = [
  [1320, 2868, 440, 956, 3], [1290, 2796, 430, 932, 3], [1206, 2622, 402, 874, 3], [1179, 2556, 393, 852, 3],
  [1284, 2778, 428, 926, 3], [1170, 2532, 390, 844, 3], [1125, 2436, 375, 812, 3], [1242, 2688, 414, 896, 3],
  [828, 1792, 414, 896, 2], [1242, 2208, 414, 736, 3], [750, 1334, 375, 667, 2], [640, 1136, 320, 568, 2],
  [2048, 2732, 1024, 1366, 2], [1668, 2388, 834, 1194, 2], [1640, 2360, 820, 1180, 2], [1620, 2160, 810, 1080, 2], [1536, 2048, 768, 1024, 2],
];
for (const [w, h] of SPLASH) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(splashHtml(w, h));
  await page.screenshot({ path: path.join(root, `public/splash/splash-${w}x${h}.png`) });
}
fs.writeFileSync(path.join(root, "src/lib/splash-screens.json"), JSON.stringify(SPLASH));
await browser.close();
console.log("icons and", SPLASH.length, "splash images written");
