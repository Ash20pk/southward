import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type BtnVariant = "primary" | "quiet" | "outline" | "danger";

const btn = (variant: BtnVariant, size: "sm" | "md") =>
  clsx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    size === "sm" ? "h-9 px-4 text-sm" : "h-11 px-5 text-[0.95rem]",
    variant === "primary" && "bg-brand text-brand-ink hover:brightness-110",
    variant === "quiet" && "text-ink hover:bg-sunk",
    variant === "outline" && "border border-line bg-surface text-ink hover:border-brand",
    variant === "danger" && "border border-bad/40 text-bad hover:bg-bad-soft",
  );

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <button className={clsx(btn(variant, size), className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <Link className={clsx(btn(variant, size), className)} {...rest} />;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  // Only apply the default background when the caller doesn't set one; two bg-* classes fight by stylesheet order.
  const customBg = /(^|\s)bg-/.test(className ?? "");
  const customPad = /(^|\s)(sm:)?p-/.test(className ?? "");
  return (
    <section className={clsx("rounded-2xl border border-line", !customBg && "bg-surface", !customPad && "p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function PageHeader({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.4rem] sm:leading-[1.1]">{title}</h1>
        {lede && <p className="mt-3 text-[1.05rem] leading-relaxed text-muted">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Bar({ value, color = "var(--brand)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx("h-2 overflow-hidden rounded-full bg-ink/10", className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Chip({
  active,
  className,
  ...rest
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      aria-pressed={active}
      className={clsx(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-brand bg-brand-soft text-ink" : "border-line bg-surface text-muted hover:text-ink",
        className,
      )}
      {...rest}
    />
  );
}

export function DisciplineDot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  );
}
