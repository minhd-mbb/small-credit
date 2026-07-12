import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "./src/lib/supabaseServer";
import { prisma } from "./src/lib/prisma";

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

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  // Create a Supabase server client that can read cookies from the request
  const supabase = createSupabaseServerClient(req, response);

  const { data: userData, error: authError } = await supabase.auth.getUser();
  const authenticatedUser = authError ? null : userData.user;

  let role: "ADMIN" | "BANK_ADMIN" | "ACCOUNT" | undefined;

  if (authenticatedUser?.email) {
    const user = await prisma.user.findUnique({ where: { email: authenticatedUser.email } });
    if (user) {
      role = isAppRole(user.role) ? user.role : undefined;
    }
  }

  debugLog("request", pathname, "session", !!authenticatedUser, "role", role);

  if (!authenticatedUser && !AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    debugLog("redirect to /login because no session and not auth route");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (authenticatedUser && pathname === "/login") {
    if (!role) {
      debugLog("session present but invalid role, allow /login to render");
      return response;
    }

    const target = role === "ACCOUNT" ? "/dashboard" : "/control-panel";
    debugLog("redirect from /login to", target);
    return NextResponse.redirect(new URL(target, req.url));
  }

  if (!role && authenticatedUser && pathname !== "/login") {
    debugLog("redirect to /login because session exists but role invalid or missing");
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

  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route)) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
