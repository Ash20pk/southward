"use client";

import { useState } from "react";
import clsx from "clsx";
import { useSession } from "@/lib/session";
import { Button } from "./ui";
import { SouthernCross } from "./SouthernCross";

export function AuthScreen() {
  const { setUser } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  const field = "h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sky p-12 text-sky-ink lg:flex">
        <div className="text-lg font-semibold tracking-tight">Southward</div>
        <div className="mx-auto w-full max-w-sm">
          <SouthernCross stars={[80, 55, 30, 15, 45].map((v, i) => ({ key: String(i), label: "", detail: "", value: v }))} />
        </div>
        <p className="max-w-md font-serif text-xl leading-relaxed text-sky-muted">
          Sign in on any device and pick up exactly where you left off: your answers, flashcards, mocks and lessons come
          with you.
        </p>
      </div>

      <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 px-5 py-12 sm:px-8">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-3 text-muted">
            {mode === "signin" ? "Sign in to continue your AMC prep." : "One account keeps your progress safe and in sync."}
          </p>
        </div>

        <div className="flex gap-1 rounded-full bg-sunk p-1" role="tablist">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={clsx("flex-1 rounded-full py-2 text-sm", mode === m ? "bg-surface font-medium shadow-sm" : "text-muted")}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <label className="flex flex-col gap-2">
            <span className="font-medium">Your first name</span>
            <input className={field} value={form.name} onChange={set("name")} autoComplete="given-name" required />
          </label>
        )}
        <label className="flex flex-col gap-2">
          <span className="font-medium">Email</span>
          <input className={field} type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-medium">Password</span>
          <input
            className={field}
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
          />
          {mode === "signup" && <span className="text-sm text-muted">At least 8 characters.</span>}
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
