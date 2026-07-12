import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
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
    select: { resetPasswordRequested: true, username: true },
  });

  await prisma.user.updateMany({
    where: { email },
    data: { resetPasswordRequested: true },
  });

  if (user) {
    await logActivity({
      username: user.username,
      action: "REQUEST_PASSWORD_RESET",
      functionName: "General",
      beforeChange: { resetPasswordRequested: user.resetPasswordRequested },
      afterChange: { resetPasswordRequested: true },
    });
  }

  return NextResponse.json({
    data: {
      message: "Password reset request has been recorded.",
    },
  });
}
