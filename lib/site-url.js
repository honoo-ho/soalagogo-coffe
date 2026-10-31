import { headers } from "next/headers";

export async function getSiteOrigin() {
  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000"
  )
    .split(",")[0]
    .trim();
  const protoDiteruskan = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protokol = protoDiteruskan === "http" || host.startsWith("localhost") ? "http" : "https";

  try {
    const url = new URL(`${protokol}://${host}`);
    if (url.username || url.password) return "http://localhost:3000";
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}
