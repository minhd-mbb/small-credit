import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function ensureSupabaseServerEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for Supabase server client",
    );
  }

  return { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY };
}

function parseCookieHeader(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return [];

  return cookieHeader.split(";").map((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return { name: part.trim(), value: "" };
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    return { name, value };
  });
}

function cookiesFromRequest(req: NextRequest) {
  // Some runtimes expose req.cookies.getAll(), otherwise parse header
  if (typeof (req as any).cookies?.getAll === "function") {
    // Map from { name, value } or NextRequestCookie to plain object
    return req.cookies.getAll().map((cookie: any) => ({
      name: cookie.name,
      value: cookie.value,
    }));
  }

  return parseCookieHeader(req.headers.get("cookie"));
}

async function cookiesFromHeaders() {
  // Prefer the cookies() helper when it exposes getAll, otherwise read raw header
  try {
    const c: any = await cookies();
    if (typeof (c as any)?.getAll === "function") {
      const all = await (c as any).getAll();
      return all.map((cookie: any) => ({ name: cookie.name, value: cookie.value }));
    }
  } catch (e) {
    // ignore and fallback to headers
  }

  try {
    const h: any = await headers();
    let cookieHeader: string | null | undefined = undefined;
    if (h) {
      if (typeof h.get === "function") {
        cookieHeader = h.get("cookie");
      } else if (typeof h.header === "function") {
        cookieHeader = h.header("cookie");
      } else if ("cookie" in h) {
        cookieHeader = (h as any).cookie;
      } else if (h?.headers && typeof h.headers.get === "function") {
        cookieHeader = h.headers.get("cookie");
      }
    }

    return parseCookieHeader(cookieHeader as string | null | undefined);
  } catch (e) {
    return [];
  }
}

export function createSupabaseServerClientFromHeaders() {
  const { supabaseUrl, supabaseKey } = ensureSupabaseServerEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: cookiesFromHeaders,
    },
  });
}

export function createSupabaseServerClient(req: NextRequest, response: NextResponse) {
  const { supabaseUrl, supabaseKey } = ensureSupabaseServerEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookiesFromRequest(req),
      setAll: (cookieItems) => {
        for (const cookie of cookieItems) {
          response.cookies.set({
            name: cookie.name,
            value: cookie.value,
            ...cookie.options,
          } as any);
        }
      },
    },
  });
}
