import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BayatlamaSavar",
    short_name: "BayatlamaSavar",
    description:
      "Ambalajı açılan gıdaların raf ömrünü takip et, gıda israfını önle.",
    lang: "tr",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
