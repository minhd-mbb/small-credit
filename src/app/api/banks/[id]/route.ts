import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { bankUpdateSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = bankUpdateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid bank data" }, { status: 400 });
  }

  const { id } = await context.params;
  const before = await prisma.bank.findUnique({ where: { id } });

  if (!before) {
    return NextResponse.json({ error: "Bank not found." }, { status: 404 });
  }

  try {
    const bank = await prisma.bank.update({
      where: { id },
      data: {
        name: payload.data.name,
        code: payload.data.code ? normalizeCode(payload.data.code) : undefined,
        isActive: payload.data.isActive,
      },
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
          },
        },
      },
    });

    await logActivity({
      username: session.user.username,
      action: "UPDATE_BANK",
      functionName: "Bank management",
      beforeChange: {
        id: before.id,
        name: before.name,
        code: before.code,
        isActive: before.isActive,
      },
      afterChange: {
        id: bank.id,
        name: bank.name,
        code: bank.code,
        isActive: bank.isActive,
      },
    });

    return NextResponse.json({ data: bank });
  } catch {
    return NextResponse.json(
      { error: "Bank could not be updated." },
      { status: 409 },
    );
  }
}
