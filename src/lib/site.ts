/**
 * The public website's address. Set NEXT_PUBLIC_SITE_URL once there's a custom domain; until then Vercel's
 * production URL is used, and localhost in development.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const SITE_NAME = "Southward";
export const SITE_TAGLINE = "AMC exam prep for Indian medical graduates";
export const SITE_DESCRIPTION =
  "Prepare for the Australian Medical Council exams from India: a guided course across all 52 AMC topics, AMC-style MCQs, timed mock exams, spaced-repetition flashcards and clinical stations with an AI patient and examiner.";

/** Where the app lives. Sign-up and sign-in happen there. */
export const APP_PATH = "/app";
export const SIGNUP_PATH = "/app?signup=1";

/** Shown only when set, so the site never publishes a placeholder address. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export const PUBLIC_NAV = [
  { href: "/amc-pathway", label: "AMC pathway" },
  { href: "/topics", label: "Topics" },
  { href: "/australia-101", label: "Australia 101" },
];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const factSlug = (f: { title: string }) => slugify(f.title);
