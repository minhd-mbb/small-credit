import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const body = await request.json();
  const username = usernameSchema.safeParse(body.username);

  if (!username.success) {
    return NextResponse.json(
      { error: "Username must contain 4-10 digits." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { username: username.data },
    select: { resetPasswordRequested: true },
  });

  await prisma.user.updateMany({
    where: { username: username.data },
    data: { resetPasswordRequested: true },
  });

  if (user) {
    await logActivity({
      username: username.data,
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
