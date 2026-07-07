import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const body = await request.json();
  const username = usernameSchema.safeParse(body.username);

  if (!username.success) {
    return NextResponse.json({ data: { inactive: false } });
  }

  const user = await prisma.user.findUnique({
    where: { username: username.data },
    select: { isActive: true },
  });

  return NextResponse.json({
    data: {
      inactive: user ? !user.isActive : false,
    },
  });
}
