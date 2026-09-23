"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BookOpenText, Monitor, Moon, Sun } from "lucide-react";
import { applyTextSize, applyTheme, getTextSize, getTheme, type TextSize, type Theme } from "@/lib/prefs";

const THEMES: { id: Theme; label: string; icon: typeof Sun; hint: string }[] = [
  { id: "light", label: "Day", icon: Sun, hint: "Soft grey paper, low glare" },
  { id: "sepia", label: "Reading", icon: BookOpenText, hint: "Warm paper for long sessions" },
  { id: "dark", label: "Night", icon: Moon, hint: "Dim, for late study" },
  { id: "system", label: "Auto", icon: Monitor, hint: "Follow this device" },
];

export function ThemePicker({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [text, setText] = useState<TextSize>("normal");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getTheme());
    setText(getTextSize());
  }, []);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };
  const pickText = (s: TextSize) => {
    setText(s);
    applyTextSize(s);
  };

  if (compact)
    return (
      <div className="flex items-center gap-1 rounded-full bg-sunk p-1" role="radiogroup" aria-label="Colour theme">
        {THEMES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="radio"
            aria-checked={theme === id}
            aria-label={label}
            title={label}
            onClick={() => pickTheme(id)}
            className={clsx(
              "grid h-8 flex-1 place-items-center rounded-full transition-colors",
              theme === id ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {THEMES.map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            role="radio"
            aria-checked={theme === id}
            onClick={() => pickTheme(id)}
            className={clsx(
              "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
              theme === id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/50",
            )}
          >
            <Icon size={18} className={theme === id ? "text-brand" : "text-muted"} />
            <span className="font-medium">{label}</span>
            <span className="text-sm leading-snug text-muted">{hint}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted">Text size</span>
        <div className="flex gap-1 rounded-full bg-sunk p-1" role="radiogroup" aria-label="Text size">
          {(["normal", "large"] as TextSize[]).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={text === s}
              onClick={() => pickText(s)}
              className={clsx("rounded-full px-4 py-1.5 text-sm capitalize", text === s ? "bg-surface font-medium shadow-sm" : "text-muted")}
            >
              {s === "normal" ? "Standard" : "Larger"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
