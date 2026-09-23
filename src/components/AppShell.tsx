"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  BookOpen,
  Layers,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Settings,
  Stethoscope,
  Sunrise,
  Target,
  Timer,
  X,
} from "lucide-react";
import { useHydrated, useStore } from "@/lib/store";
import { Onboarding } from "./Onboarding";

const NAV = [
  { href: "/", label: "Today", icon: Sunrise },
  { href: "/pathway", label: "Your pathway", icon: Map },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/mock", label: "Mock exam", icon: Timer },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/clinical", label: "Clinical stations", icon: Stethoscope },
  { href: "/tutor", label: "Ask the tutor", icon: MessageCircle },
  { href: "/australia", label: "Australia 101", icon: MapPin },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--sky)" />
        {[
          [16, 25, 2.1],
          [9, 14, 1.6],
          [17, 6, 1.8],
          [23.5, 12.5, 1.3],
          [20, 18, 0.9],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--ochre)" />
        ))}
      </svg>
      <span className="text-[1.2rem] font-semibold tracking-tight">Southward</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const [open, setOpen] = useState(false);

  // Full-screen focus modes hide the chrome.
  const focus = /^\/(mock\/run|clinical\/.+)/.test(path);

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors",
              active ? "bg-brand-soft font-medium text-ink" : "text-muted hover:bg-sunk hover:text-ink",
            )}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-brand" : undefined} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  if (!hydrated) return <div className="min-h-dvh" />;
  if (!profile) return <Onboarding />;

  if (focus) return <main className="min-h-dvh">{children}</main>;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        {nav}
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted">
          Independent study aid. Not affiliated with the Australian Medical Council.
        </p>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-sunk">
          <Menu size={22} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col gap-6 bg-paper p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Logo />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-sunk">
                <X size={22} />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-8 lg:pt-12">{children}</main>
    </div>
  );
}
