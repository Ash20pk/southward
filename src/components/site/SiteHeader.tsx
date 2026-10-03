"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AppCta } from "@/components/site/client";
import { APP_PATH, PUBLIC_NAV } from "@/lib/site";
import { onFrame } from "@/lib/frame";

/**
 * Floats over night-sky sections (marked data-header="night") in light type, and turns into the usual paper bar over
 * everything else. Over the night sky it's see-through only at the very top, so text never scrolls through it.
 * Pages without a night section always get the paper bar.
 */
export function SiteHeader() {
  const [night, setNight] = useState(false);
  const [atTop, setAtTop] = useState(true);

  useEffect(
    () =>
      onFrame(() => {
        // What's directly under the bottom edge of the header decides its colours.
        const under = document.elementsFromPoint(8, 64).find((el) => !el.closest("header"));
        const isNight = !!under?.closest('[data-header="night"]');
        const top = window.scrollY < 8;
        return () => {
          setNight(isNight);
          setAtTop(top);
        };
      }),
    [],
  );

  const link = night ? "text-sky-muted hover:bg-white/10 hover:text-sky-ink" : "text-muted hover:bg-sunk hover:text-ink";

  return (
    <header
      className={clsx(
        "sticky top-0 z-30 transition-colors duration-300",
        night
          ? clsx("border-b text-sky-ink", atTop
                ? "border-transparent bg-transparent"
                : // No blur on phones: it would re-blur the moving globe under it every frame.
                  "border-white/[0.07] bg-[#070b14]/92 sm:bg-[#070b14]/70 sm:backdrop-blur-xl")
          : "border-b border-line bg-paper/95 sm:bg-paper/90 sm:backdrop-blur",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-8">
        {/* Under 360px there's only room for the mark next to "Sign in" and the button. */}
        <Logo href="/" className={clsx("max-[359px]:[&>span]:sr-only", night && "text-sky-ink!")} />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((l) => (
            <Link key={l.href} href={l.href} className={clsx("rounded-full px-3 py-2 text-[0.95rem] transition-colors", link)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href={APP_PATH} className={clsx("whitespace-nowrap rounded-full px-2 py-2 text-sm sm:px-3 sm:text-[0.95rem]", link)}>
            Sign in
          </Link>
          <AppCta size="sm" />
          <details className="group relative md:hidden">
            <summary
              aria-label="Menu"
              className={clsx(
                "grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full [&::-webkit-details-marker]:hidden",
                night ? "hover:bg-white/10" : "hover:bg-sunk",
              )}
            >
              <Menu size={20} />
            </summary>
            <nav aria-label="Main" className="absolute right-0 top-11 flex w-56 flex-col rounded-2xl border border-line bg-surface p-2 text-ink shadow-xl">
              {PUBLIC_NAV.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2.5 hover:bg-sunk">
                  {l.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
