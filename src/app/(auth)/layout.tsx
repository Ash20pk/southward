import type { Metadata } from "next";

// Sign-in and sign-up pages: their own screens, outside the website's header and the app's shell, and not for search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
