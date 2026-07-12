import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLoginEmail } from "@/lib/login-identity";

export async function POST(request: Request) {
  const body = await request.json();
  const email = resolveLoginEmail(String(body.username ?? ""));

  if (!email) {
    return NextResponse.json(
      { error: "Email or username is invalid." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      username: true,
      fullName: true,
      isActive: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}
