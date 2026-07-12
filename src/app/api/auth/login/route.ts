import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deriveSupabasePassword } from "@/lib/supabase-password";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  const payload = loginSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: payload.data.email },
    select: { isActive: true, passwordHash: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(
    payload.data.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { data: authUsers, error: listError } =
    await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = authUsers?.users.find(
    (candidate) => candidate.email?.toLowerCase() === payload.data.email.toLowerCase(),
  );

  if (listError || !authUser) {
    return NextResponse.json(
      { error: "Authentication account is not configured" },
      { status: 503 },
    );
  }

  const supabasePassword = await deriveSupabasePassword(payload.data.password);
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    authUser.id,
    { password: supabasePassword },
  );

  if (updateError) {
    return NextResponse.json(
      { error: "Authentication account could not be synchronized" },
      { status: 503 },
    );
  }

  return NextResponse.json({ data: { synchronized: true } });
}
