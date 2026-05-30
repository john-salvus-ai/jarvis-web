import { NextResponse } from "next/server";
import { COOKIE_NAME, authToken, proxyToken, getPassword } from "./lib/auth";

// Run on everything except Next static assets and the public logo/icon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|salvus-logo.png|icon.png).*)"],
};

export async function middleware(req) {
  const pw = getPassword();

  // Fail OPEN when no password is configured in this environment.
  // (Lets you deploy safely; the gate only activates once you set JARVIS_PASSWORD.)
  if (!pw) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always allow the login page and the login API itself.
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  // Allow trusted server-to-server proxy calls (Vercel -> home server).
  const proxyHeader = req.headers.get("x-jarvis-proxy");
  if (proxyHeader && proxyHeader === (await proxyToken(pw))) return NextResponse.next();

  // Allow logged-in browsers.
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && cookie === (await authToken(pw))) return NextResponse.next();

  // Block everything else.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
