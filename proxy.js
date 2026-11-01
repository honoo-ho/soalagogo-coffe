import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cekBatasPermintaan } from "@/lib/rate-limit";

function buatCsp(nonce) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const sumberSupabase = process.env.SUPABASE_URL
    ? (() => {
        try {
          return new URL(process.env.SUPABASE_URL).origin;
        } catch {
          return "";
        }
      })()
    : "";

  // Next/React membutuhkan unsafe-eval hanya di development untuk pesan debug.
  // Production selalu memakai nonce tanpa unsafe-eval atau unsafe-inline.
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com${isDevelopment ? " 'unsafe-inline'" : ""}`,
    `img-src 'self' data: blob:${sumberSupabase ? ` ${sumberSupabase}` : ""}`,
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buatCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const buatResponse = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  };

  const pathname = request.nextUrl.pathname;
  if (request.method === "POST") {
    let ruangLingkup = null;
    let batas = 0;
    let periodeMs = 60_000;
    let pesan = "Terlalu banyak permintaan. Silakan tunggu sebelum mencoba lagi.";

    if (pathname === "/admin/login") {
      ruangLingkup = "login-admin";
      batas = 5;
      periodeMs = 15 * 60_000;
      pesan = "Terlalu banyak percobaan login. Silakan tunggu sebelum mencoba lagi.";
    } else if (/^\/produk\/\d+$/.test(pathname)) {
      ruangLingkup = "form-publik-produk";
      batas = 5;
    } else if (pathname === "/api/whatsapp-click") {
      ruangLingkup = "klik-whatsapp-publik";
      batas = 30;
    }

    if (ruangLingkup) {
      const limit = cekBatasPermintaan(request.headers, ruangLingkup, batas, periodeMs);
      if (!limit.allowed) {
        const response = NextResponse.json({ error: pesan }, { status: 429 });
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("Retry-After", String(limit.retryAfter));
        response.headers.set("Content-Security-Policy", contentSecurityPolicy);
        return response;
      }
    }
  }

  const matchProduk = pathname.match(/^\/produk\/([^/]+)$/);
  if (request.method === "GET" && matchProduk) {
    const rawId = matchProduk[1];
    let adaProduk = false;
    if (/^\d+$/.test(rawId)) {
      try {
        const idNum = BigInt(rawId);
        if (idNum > 0n && idNum <= 9223372036854775807n) {
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
          if (supabaseUrl && supabaseSecretKey) {
            const { createClient } = await import("@supabase/supabase-js");
            const sb = createClient(supabaseUrl, supabaseSecretKey);
            const { data, error } = await sb
              .from("produk")
              .select("id")
              .eq("id", rawId)
              .eq("aktif", true)
              .maybeSingle();
            if (error) {
              // Database error – respond with 503 Service Unavailable
              return new NextResponse("Service Unavailable", {
                status: 503,
                headers: { "Content-Security-Policy": contentSecurityPolicy },
              });
            }
            adaProduk = Boolean(data);
          } else {
            // Missing Supabase credentials – treat as server issue
            return new NextResponse("Service Unavailable", {
              status: 503,
              headers: { "Content-Security-Policy": contentSecurityPolicy },
            });
          }
        }
      } catch {
        adaProduk = false;
      }
    }

    if (!adaProduk) {
      const notFoundRes = NextResponse.rewrite(new URL("/_not-found", request.url), {
        status: 404,
        headers: {
          "Content-Security-Policy": contentSecurityPolicy,
        },
      });
      return notFoundRes;
    }
  }

  const perluLogin = pathname.startsWith("/admin/") || pathname === "/admin";
  if (!perluLogin || pathname === "/admin/login") return buatResponse();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    const response = NextResponse.redirect(new URL("/admin/login", request.url));
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  }

  let response = buatResponse();
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        requestHeaders.set("cookie", request.cookies.toString());
        response = buatResponse();
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginResponse = NextResponse.redirect(new URL("/admin/login", request.url));
    loginResponse.headers.set("Content-Security-Policy", contentSecurityPolicy);
    for (const cookie of response.cookies.getAll()) {
      loginResponse.cookies.set(cookie);
    }
    return loginResponse;
  }

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
