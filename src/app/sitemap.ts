import type { MetadataRoute } from "next";
import { AUS_FACTS, SYLLABUS } from "@/lib/content";
import { SITE_URL, factSlug } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({ url: `${SITE_URL}${path}`, priority });
  return [
    page("/", 1),
    page("/amc-pathway", 0.9),
    page("/topics", 0.9),
    page("/australia-101", 0.8),
    ...SYLLABUS.map((t) => page(`/topics/${t.id}`, 0.7)),
    ...AUS_FACTS.map((f) => page(`/australia-101/${factSlug(f)}`, 0.6)),
    page("/privacy", 0.2),
    page("/terms", 0.2),
  ];
}
