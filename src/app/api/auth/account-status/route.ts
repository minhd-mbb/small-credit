import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLoginEmail } from "@/lib/login-identity";

export async function POST(request: Request) {
  const body = await request.json();
  const email = resolveLoginEmail(String(body.username ?? ""));

  if (!email) {
    return NextResponse.json({ data: { inactive: false } });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { isActive: true },
  });

  return NextResponse.json({
    data: {
      inactive: user ? !user.isActive : false,
    },
  });
}
