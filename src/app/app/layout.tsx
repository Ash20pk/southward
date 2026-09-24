import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

// The app is personal and behind sign-in, so it stays out of search results; the public site is what gets indexed.
export const metadata: Metadata = {
  title: "Southward",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
