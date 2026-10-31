import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

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
