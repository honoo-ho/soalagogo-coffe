import { ambilPengaturanToko } from "@/lib/pengaturan-toko";

export default async function manifest() {
  const pengaturanToko = await ambilPengaturanToko();
  return {
    id: "/",
    name: pengaturanToko.nama,
    short_name: "Katalog",
    description: pengaturanToko.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f6b4f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
