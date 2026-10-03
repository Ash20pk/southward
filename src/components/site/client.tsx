"use client";

import { useEffect, useSyncExternalStore } from "react";
import clsx from "clsx";
import Link from "next/link";
import { APP_PATH, SIGNUP_PATH } from "@/lib/site";

// Read straight from localStorage rather than importing the store, so the website doesn't ship the app's state code.
function hasLocalProfile() {
  try {
    const raw = localStorage.getItem("southward-v1");
    return !!raw && !!JSON.parse(raw)?.state?.profile;
  } catch {
    return false;
  }
}

const noop = () => () => {};

/** "Start free" for newcomers; "Continue studying" for anyone who has already set up the app in this browser. */
export function AppCta({
  size = "md",
  tone = "brand",
  label = "Start free",
}: {
  size?: "sm" | "md";
  tone?: "brand" | "ochre";
  label?: string;
}) {
  const returning = useSyncExternalStore(noop, hasLocalProfile, () => false);
  return (
    <Link
      href={returning ? APP_PATH : SIGNUP_PATH}
      className={clsx(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition hover:brightness-110",
        size === "sm" ? "h-9 px-4 text-sm" : "h-11 px-5 text-[0.95rem]",
        tone === "brand" ? "bg-brand text-brand-ink" : "bg-ochre text-sky",
      )}
    >
      {returning ? (
        <>
          Continue<span className={size === "sm" ? "hidden sm:inline" : undefined}>&nbsp;studying</span>
        </>
      ) : (
        label
      )}
    </Link>
  );
}

/**
 * Phones that installed Southward before the website existed open "/" (iOS keeps the start URL from install time),
 * so an installed app landing here goes straight on to the app.
 */
export function StandaloneRedirect() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) window.location.replace(APP_PATH);
  }, []);
  return null;
}
