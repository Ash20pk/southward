"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  ArrowLeftRight,
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
import { ThemePicker } from "./ThemePicker";
import { AuthScreen } from "./AuthScreen";
import { SyncBadge } from "./SyncBadge";
import { Splash } from "./Splash";
import { useSession } from "@/lib/session";
import { useSync } from "@/hooks/useSync";

// The five things she does most, one tap away on a phone.
const TABS = [
  { href: "/", label: "Today", icon: Sunrise },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/flashcards", label: "Cards", icon: Layers },
  { href: "/tutor", label: "Tutor", icon: MessageCircle },
];

// Grouped by which AMC exam each section prepares for, so it's always clear what counts for Part 1 vs Part 2.
const NAV_GROUPS: { title?: string; items: { href: string; label: string; icon: typeof Sunrise }[] }[] = [
  {
    items: [
      { href: "/", label: "Today", icon: Sunrise },
      { href: "/pathway", label: "Your pathway", icon: Map },
      { href: "/mbbs", label: "MBBS ↔ AMC", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Part 1: MCQ exam",
    items: [
      { href: "/learn", label: "Learn", icon: BookOpen },
      { href: "/practice", label: "Practice", icon: Target },
      { href: "/mock", label: "Mock exam", icon: Timer },
      { href: "/flashcards", label: "Flashcards", icon: Layers },
    ],
  },
  { title: "Part 2: Clinical exam", items: [{ href: "/clinical", label: "Clinical stations", icon: Stethoscope }] },
  {
    items: [
      { href: "/tutor", label: "Ask the tutor", icon: MessageCircle },
      { href: "/australia", label: "Australia 101", icon: MapPin },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
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
  const session = useSession();
  const synced = useSync(session.user?.id ?? null);

  useEffect(() => {
    session.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Full-screen focus modes hide the chrome.
  const focus = /^\/(mock\/run|clinical\/.+|learn\/[^/]+\/[^/]+)/.test(path);

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {NAV_GROUPS.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.title && <p className="px-3 pb-1 text-xs font-semibold text-muted">{g.title}</p>}
          {g.items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[0.95rem] transition-colors",
                  active ? "bg-brand-soft font-medium text-ink" : "text-muted hover:bg-sunk hover:text-ink",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-brand" : undefined} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  if (!hydrated || !session.loaded) return <Splash />;
  if (session.mode === "account" && !session.user) return <AuthScreen />;
  if (session.user && !synced) return <Splash note="Loading your progress…" />;
  if (!profile) return <Onboarding defaultName={session.user?.name} />;

  if (focus) return <main className="min-h-dvh">{children}</main>;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <div className="min-h-0 overflow-y-auto">{nav}</div>
        <div className="mt-auto flex flex-col gap-3 px-1">
          <ThemePicker compact />
          {session.user && <SyncBadge />}
          <p className="px-2 text-xs leading-relaxed text-muted">
            Independent study aid. Not affiliated with the Australian Medical Council.
          </p>
        </div>
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
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <ThemePicker compact />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-8 lg:pb-24 lg:pt-12">{children}</main>

      <nav
        aria-label="Quick"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx("flex flex-col items-center gap-0.5 py-2.5 text-[11px]", active ? "font-medium text-brand" : "text-muted")}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
