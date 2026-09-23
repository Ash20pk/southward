// Generates the app icon (SVG master) and every PNG size the web app manifest, iOS and Android need,
// plus iOS launch (splash) images. Run with: node scripts/make-icons.mjs (needs Playwright).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const NAVY = "#152640";
const OCHRE = "#e0a526";
const PAPER = "#eef2f7";

// The Southward mark: the Southern Cross as five ochre stars on a navy tile (the original header logo, 32 x 32 grid).
const STARS = [
  [16, 25, 2.1],
  [9, 14, 1.6],
  [17, 6, 1.8],
  [23.5, 12.5, 1.3],
  [20, 18, 0.9],
];

/**
 * `rounded`: tile corners as in the header logo (off for maskable and iOS icons, which the OS rounds itself).
 * `scale`: 1 keeps the header logo's proportions; maskable icons shrink the stars into the central safe zone.
 */
function iconSvg(size, { rounded = true, scale = 1 } = {}) {
  const stars = STARS.map(([x, y, r]) => `<circle cx="${16 + (x - 16) * scale}" cy="${16 + (y - 16) * scale}" r="${r * scale}" fill="${OCHRE}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
<rect width="32" height="32" rx="${rounded ? 9 : 0}" fill="${NAVY}"/>${stars}</svg>`.replace(/\n/g, "");
}

function splashHtml(w, h) {
  const s = Math.min(w, h) * 0.34;
  return `<html><body style="margin:0;width:${w}px;height:${h}px;background:${NAVY};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${s * 0.18}px;font-family:-apple-system,Helvetica,Arial,sans-serif">
${iconSvg(Math.round(s), { rounded: true }).replace("<svg ", `<svg style="filter:drop-shadow(0 ${s * 0.04}px ${s * 0.12}px rgba(0,0,0,.35))" `)}
<div style="color:${PAPER};font-size:${s * 0.2}px;font-weight:600;letter-spacing:-0.01em">Southward</div>
</body></html>`;
}

// Master SVGs: favicon (Next.js app/icon.svg) and a copy in public.
fs.writeFileSync(path.join(root, "src/app/icon.svg"), iconSvg(64));
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
await png(iconSvg(512, { rounded: false, scale: 0.78 }), 512, path.join(root, "public/icons/icon-maskable-512.png"));
await png(iconSvg(192, { rounded: false, scale: 0.78 }), 192, path.join(root, "public/icons/icon-maskable-192.png"));
// iOS home screen icon: square, no transparency (iOS rounds it).
await png(iconSvg(180, { rounded: false }), 180, path.join(root, "src/app/apple-icon.png"));

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
