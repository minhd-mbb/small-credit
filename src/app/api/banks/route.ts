import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { bankCreateSchema } from "@/lib/validations";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export async function GET() {
  const session = await getServerSession();

  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const banks = await prisma.bank.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          users: true,
          accounts: true,
        },
      },
    },
  });

  return NextResponse.json({ data: banks });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = bankCreateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid bank data" }, { status: 400 });
  }

  try {
    const bank = await prisma.bank.create({
      data: {
        name: payload.data.name,
        code: normalizeCode(payload.data.code),
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
      action: "CREATE_BANK",
      functionName: "Bank management",
      beforeChange: null,
      afterChange: {
        id: bank.id,
        name: bank.name,
        code: bank.code,
        isActive: bank.isActive,
      },
    });

    return NextResponse.json({ data: bank }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Bank name or code already exists." },
      { status: 409 },
    );
  }
}
