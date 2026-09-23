import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Southward",
    short_name: "Southward",
    description: "A guided path from MBBS to the Australian Medical Council exams: lessons, questions, mock exams, flashcards and clinical stations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // Android builds its launch screen from these: the icon on the night-sky navy.
    background_color: "#152640",
    theme_color: "#152640",
    categories: ["education", "medical"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Continue learning", url: "/learn", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Practice questions", url: "/practice", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Flashcards", url: "/flashcards", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
