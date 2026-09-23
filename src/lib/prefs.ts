// Display preferences live outside the progress store so they can be applied before React loads.
export type Theme = "system" | "light" | "sepia" | "dark";
export type TextSize = "normal" | "large";

const THEME_KEY = "southward-theme";
const TEXT_KEY = "southward-text";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

export function getTheme(): Theme {
  const v = read(THEME_KEY);
  return v === "light" || v === "sepia" || v === "dark" ? v : "system";
}
export function getTextSize(): TextSize {
  return read(TEXT_KEY) === "large" ? "large" : "normal";
}

export function applyTheme(t: Theme) {
  write(THEME_KEY, t);
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
}
export function applyTextSize(s: TextSize) {
  write(TEXT_KEY, s);
  const el = document.documentElement;
  if (s === "large") el.setAttribute("data-text", "large");
  else el.removeAttribute("data-text");
}

/** Inline in <head> so the saved theme is on <html> before first paint (no flash). */
export const PREFS_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="sepia"||t==="dark")document.documentElement.setAttribute("data-theme",t);if(localStorage.getItem("${TEXT_KEY}")==="large")document.documentElement.setAttribute("data-text","large")}catch(e){}`;
