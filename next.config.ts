import type { NextConfig } from "next";

// The app used to live at the root; it moved under /app when the public website took over "/".
// Old links and bookmarks keep working.
const APP_ROUTES = ["learn", "practice", "flashcards", "tutor", "clinical", "mock", "mbbs", "pathway", "australia", "settings"];

const nextConfig: NextConfig = {
  async redirects() {
    return APP_ROUTES.flatMap((r) => [
      { source: `/${r}`, destination: `/app/${r}`, permanent: true },
      { source: `/${r}/:path*`, destination: `/app/${r}/:path*`, permanent: true },
    ]);
  },
  async headers() {
    return [
      {
        // The service worker must never be cached, or phones would keep an old version of the app.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
