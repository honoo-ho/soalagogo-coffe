import { getSiteOrigin } from "@/lib/site-url";

export default async function robots() {
  const asal = await getSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/keranjang", "/favorit"],
    },
    sitemap: `${asal}/sitemap.xml`,
  };
}
