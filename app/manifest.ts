import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EditForge Production Studio",
    short_name: "EditForge",
    description: "A private AI-native production studio for briefs, media, renders, review, and delivery.",
    start_url: "/",
    display: "standalone",
    background_color: "#14201f",
    theme_color: "#14201f",
    orientation: "any",
    categories: ["photo", "video", "productivity"],
    icons: [
      {
        src: "/icons/editforge-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/editforge-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

