"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useSession } from "@/lib/session";
import { Logo } from "./Logo";
import { SouthernCross } from "./SouthernCross";

type Mode = "signin" | "signup";

const COPY: Record<Mode, { title: string; lede: string; submit: string; busy: string }> = {
  signin: { title: "Welcome back", lede: "Pick up right where you left off.", submit: "Sign in", busy: "Signing in…" },
  signup: { title: "Create your account", lede: "It's free during early access.", submit: "Create account", busy: "Creating account…" },
};

/*
 * Nothing above the fields moves when you switch between signing in and creating an account:
 * - the form is pinned from the top rather than re-centred, so a taller form grows downwards only;
 * - text that differs by mode sits in one grid cell with both versions stacked, so the cell is always as tall as the longer one;
 * - the only thing that appears (the name field) and an error both slide open instead of jumping in.
 */
export function AuthScreen() {
  const { setUser } = useSession();
  // Only rendered after hydration (AppShell shows the splash until then), so reading the URL here is safe.
  // The website's "Start free" buttons link to /app?signup=1.
  const [mode, setMode] = useState<Mode>(() => (new URLSearchParams(window.location.search).has("signup") ? "signup" : "signin"));
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  // Honeypot: an off-screen field that people never see or reach, but form-filling bots complete.
  const [trap, setTrap] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const signup = mode === "signup";

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(signup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signup ? { ...form, website: trap } : { email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setUser(data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    "h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none transition-colors placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sky p-12 text-sky-ink lg:flex">
        <Link href="/" className="self-start text-lg font-semibold tracking-tight hover:text-white">
          Southward
        </Link>
        <div className="mx-auto w-full max-w-sm">
          <SouthernCross stars={[80, 55, 30, 15, 45].map((v, i) => ({ key: String(i), label: "", detail: "", value: v }))} />
        </div>
        <p className="max-w-md font-serif text-xl leading-relaxed text-sky-muted">
          Sign in on any device and pick up exactly where you left off: your answers, flashcards, mocks and lessons come
          with you.
        </p>
      </div>

      <div className="flex flex-col px-5 pb-10 sm:px-8">
        <div className="flex h-16 items-center justify-between lg:h-auto lg:justify-end lg:pt-12">
          <Logo href="/" className="lg:hidden" />
          <Link href="/" className="text-sm text-muted hover:text-ink">
            About Southward
          </Link>
        </div>

        {/* Pinned from the top (not centred), placed so the taller sign-up form sits roughly mid-screen on a laptop. */}
        <div className="mx-auto w-full max-w-sm pt-8 sm:pt-14 lg:pt-[max(2rem,calc(50dvh-22rem))]">
          <Swap
            active={mode}
            className="mb-8"
            items={{
              signin: <Heading {...COPY.signin} />,
              signup: <Heading {...COPY.signup} />,
            }}
          />

          <div role="tablist" aria-label="Account" className="relative mb-7 grid grid-cols-2 rounded-full bg-sunk p-1">
            <span
              aria-hidden
              className={clsx(
                "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-surface shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none",
                signup && "translate-x-full",
              )}
            />
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                id={`tab-${m}`}
                type="button"
                role="tab"
                aria-selected={mode === m}
                aria-controls="auth-form"
                onClick={() => switchTo(m)}
                className={clsx("relative z-10 h-10 rounded-full text-sm transition-colors", mode === m ? "font-medium text-ink" : "text-muted hover:text-ink")}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form id="auth-form" role="tabpanel" aria-labelledby={`tab-${mode}`} onSubmit={submit}>
            <Collapse open={signup}>
              <label className="block pb-5">
                <span className="mb-2 block text-sm font-medium">First name</span>
                <input
                  className={field}
                  value={form.name}
                  onChange={set("name")}
                  autoComplete="given-name"
                  // Disabled while hidden, so the browser neither requires it nor tabs into it.
                  disabled={!signup}
                  required
                />
              </label>
            </Collapse>

            {signup && (
              <input
                name="sw-extra"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />
            )}

            <label className="block pb-5">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <input className={field} type="email" inputMode="email" value={form.email} onChange={set("email")} autoComplete="email" required />
            </label>

            <label className="block">
              <span className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">Password</span>
                <span className={clsx("text-muted transition-opacity duration-200", signup ? "opacity-100" : "opacity-0")} aria-hidden={!signup}>
                  At least 8 characters
                </span>
              </span>
              <span className="relative block">
                <input
                  className={clsx(field, "pr-12")}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={signup ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-1 my-auto grid h-10 w-10 place-items-center rounded-lg text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <Collapse open={!!error}>
              <p role="alert" className="mt-5 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
                {error}
              </p>
            </Collapse>

            <button
              type="submit"
              disabled={busy}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand font-medium text-brand-ink transition hover:brightness-110 disabled:opacity-70"
            >
              {busy && <LoaderCircle size={18} className="animate-spin" aria-hidden />}
              {busy ? COPY[mode].busy : COPY[mode].submit}
            </button>

            <Swap
              active={mode}
              className="mt-5 text-center text-sm text-muted"
              items={{
                signin: (
                  <p>
                    New to Southward?{" "}
                    <button type="button" onClick={() => switchTo("signup")} className="font-medium text-brand hover:underline">
                      Create an account
                    </button>
                  </p>
                ),
                signup: (
                  <p>
                    By creating an account you agree to the{" "}
                    <Link href="/terms" className="text-brand underline">
                      terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-brand underline">
                      privacy policy
                    </Link>
                    .
                  </p>
                ),
              }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}

function Heading({ title, lede }: { title: string; lede: string }) {
  return (
    <>
      <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2.5 text-muted">{lede}</p>
    </>
  );
}

/**
 * Stacks one version per mode in a single grid cell and shows only the active one, so the space is always sized to
 * the tallest version and switching never changes the layout around it. Hidden versions use visibility: hidden,
 * which also takes their links out of the tab order and the accessibility tree.
 */
function Swap({ active, items, className }: { active: Mode; items: Record<Mode, ReactNode>; className?: string }) {
  return (
    <div className={clsx("grid", className)}>
      {(Object.keys(items) as Mode[]).map((m) => (
        <div
          key={m}
          className={clsx(
            "col-start-1 row-start-1 transition-[opacity,visibility] duration-200 motion-reduce:transition-none",
            m === active ? "visible opacity-100" : "invisible opacity-0",
          )}
        >
          {items[m]}
        </div>
      ))}
    </div>
  );
}

/** Slides content open and closed by animating its row from 0fr to 1fr, so nothing below it jumps. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
