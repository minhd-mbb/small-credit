import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_ROUTES = ["/admin", "/api/admin"];
const BANK_ADMIN_ROUTES = ["/loans", "/pledges", "/overdrafts", "/accounts"];
const AUTH_ROUTES = ["/login", "/api/auth"];
const HIDDEN_UI_ROUTES = ["/pledges", "/overdrafts"];

function normalizeRole(value: unknown) {
  return value === "ADMIN" || value === "BANK_ADMIN" || value === "ACCOUNT"
    ? value
    : "ACCOUNT";
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const role = token ? normalizeRole(token.role) : undefined;

  if (!token && !AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (token && pathname === "/login") {
    const target = role === "ACCOUNT" ? "/dashboard" : "/control-panel";
    return NextResponse.redirect(new URL(target, req.url));
  }

  if (role !== "ACCOUNT" && pathname.startsWith("/dashboard")) {
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
