import { cookies } from "next/headers";
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

export function createSupabaseServerClientFromHeaders() {
  const { supabaseUrl, supabaseKey } = ensureSupabaseServerEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: async () => (await cookies()).getAll(),
    },
  });
}

export function createSupabaseServerClient(req: NextRequest, response: NextResponse) {
  const { supabaseUrl, supabaseKey } = ensureSupabaseServerEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookieItems) => {
        for (const cookie of cookieItems) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
}
