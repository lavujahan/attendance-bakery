import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Site Attendance",
    short_name: "Attendance",
    description: "Site attendance kiosk with face verification",
    start_url: "/attendance",
    scope: "/attendance",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#047857",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
