import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { PREFS_BOOT } from "@/lib/prefs";
import { ServiceWorker } from "@/components/ServiceWorker";
import splashScreens from "@/lib/splash-screens.json";

const sans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif" });

export const metadata: Metadata = {
  title: "Southward",
  description: "A guided path from MBBS to the Australian Medical Council exams.",
  applicationName: "Southward",
  appleWebApp: {
    capable: true,
    title: "Southward",
    statusBarStyle: "default",
    // iOS shows these launch images when the installed app opens; one per device size.
    startupImage: (splashScreens as number[][]).map(([w, h, dw, dh, r]) => ({
      url: `/splash/splash-${w}x${h}.png`,
      media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#11151b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
