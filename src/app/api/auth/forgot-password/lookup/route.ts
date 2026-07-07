import { NextResponse } from "next/server";
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
