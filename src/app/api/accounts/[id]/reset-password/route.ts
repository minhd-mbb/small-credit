import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations";
import { updateSupabaseUserPassword } from "@/lib/supabase-user-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";

  for (let index = 0; index < 10; index += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return password;
}

async function canManageUser(id: string) {
  const session = await getServerSession();

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "BANK_ADMIN")) {
    return { allowed: false as const, session, user: null };
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    return { allowed: false as const, session, user: null };
  }

  if (session.user.role === "ADMIN") {
    return { allowed: true as const, session, user };
  }

  return {
    allowed:
      user.role === "ACCOUNT" && user.bankId !== null && user.bankId === session.user.bankId,
    session,
    user,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await canManageUser(id);

  if (!access.allowed || !access.user || !access.session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = resetPasswordSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid password reset data" }, { status: 400 });
  }

  const password =
    payload.data.mode === "random" ? generatePassword() : payload.data.password!;
  const passwordHash = await bcrypt.hash(password, 12);

  if (!access.user.email) {
    return NextResponse.json(
      { error: "The account does not have a Supabase email." },
      { status: 400 },
    );
  }

  try {
    await updateSupabaseUserPassword(access.user.email, password);
  } catch {
    return NextResponse.json(
      { error: "Supabase authentication password could not be updated." },
      { status: 502 },
    );
  }

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      resetPasswordRequested: false,
    },
  });

  await logActivity({
    username: access.session.user.username,
    action: "RESET_PASSWORD",
    functionName: "Account management",
    beforeChange: {
      targetUsername: access.user.username,
      resetPasswordRequested: access.user.resetPasswordRequested,
    },
    afterChange: {
      targetUsername: access.user.username,
      resetPasswordRequested: false,
      mode: payload.data.mode,
    },
  });

  return NextResponse.json({
    data: {
      id,
      newPassword: password,
    },
  });
}
