import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseUser,
  findSupabaseUserByEmail,
  updateSupabaseUserPassword,
} from "@/lib/supabase-user-admin";

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
    select: {
      isActive: true,
      passwordHash: true,
      fullName: true,
      role: true,
    },
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

  try {
    const authUser = await findSupabaseUserByEmail(payload.data.email);

    if (authUser) {
      await updateSupabaseUserPassword(payload.data.email, payload.data.password);
    } else {
      await createSupabaseUser(payload.data.email, payload.data.password, {
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
      });
    }
  } catch {
    return NextResponse.json(
      { error: "Authentication account could not be synchronized" },
      { status: 503 },
    );
  }

  return NextResponse.json({ data: { synchronized: true } });
}
