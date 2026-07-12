import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_ROUTES = ["/admin", "/api/admin"];
const BANK_ADMIN_ROUTES = ["/loans", "/pledges", "/overdrafts", "/accounts"];
const AUTH_ROUTES = ["/login", "/api/auth"];
const HIDDEN_UI_ROUTES = ["/pledges", "/overdrafts"];

function isAppRole(value: unknown): value is "ADMIN" | "BANK_ADMIN" | "ACCOUNT" {
  return value === "ADMIN" || value === "BANK_ADMIN" || value === "ACCOUNT";
}

function debugLog(...args: unknown[]) {
  if (process.env.DEBUG_MIDDLEWARE === "1") {
    console.log("[middleware]", ...args);
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const role = isAppRole(token?.role) ? token.role : undefined;

  debugLog("request", pathname, "token", token, "role", role);

  if (!token && !AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    debugLog("redirect to /login because no token and not auth route");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (token && pathname === "/login") {
    if (!role) {
      debugLog("token present but invalid role, allow /login to render");
      return NextResponse.next();
    }

    const target = role === "ACCOUNT" ? "/dashboard" : "/control-panel";
    debugLog("redirect from /login to", target);
    return NextResponse.redirect(new URL(target, req.url));
  }

  if (!role && token && pathname !== "/login") {
    debugLog("redirect to /login because token exists but role invalid or missing");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (role !== "ACCOUNT" && pathname.startsWith("/dashboard")) {
    debugLog("redirect to /control-panel because non-ACCOUNT tried to access /dashboard");
    return NextResponse.redirect(new URL("/control-panel", req.url));
  }

  if (HIDDEN_UI_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    role === "ACCOUNT" &&
    BANK_ADMIN_ROUTES.some((route) => pathname.startsWith(route)) &&
    pathname.includes("/manage")
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    ADMIN_ROUTES.some((route) => pathname.startsWith(route)) &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
