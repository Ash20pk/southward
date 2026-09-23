import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const sans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif" });

export const metadata: Metadata = {
  title: "Southward: AMC exam preparation",
  description: "A guided path from MBBS to the Australian Medical Council exams.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1524" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
