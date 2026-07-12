import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/serverSession";
import { accountUserCreateSchema } from "@/lib/validations";
import type { Prisma } from "@prisma/client";

type BankRecord = Awaited<ReturnType<typeof prisma.bank.findMany>>[number];
type UserRecord = Prisma.UserGetPayload<{ include: { bank: true } }>;

function canManageAccounts(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

function generatePassword() {
  return Math.random().toString(36).slice(2, 10);
}

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    session.user.role === "ADMIN"
      ? {}
      : session.user.role === "BANK_ADMIN"
        ? { bankId: session.user.bankId }
        : { id: session.user.id };

  const [users, banks]: [UserRecord[], BankRecord[]] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { username: "asc" }],
      include: { bank: true },
    }),
    session.user.role === "ADMIN"
      ? prisma.bank.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve<BankRecord[]>([]),
  ]);

  return NextResponse.json({
    data: users.map((user: UserRecord) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      bankId: user.bankId,
      bankName: user.bank?.name ?? null,
      isActive: user.isActive,
      resetPasswordRequested: user.resetPasswordRequested,
      createdAt: user.createdAt,
    })),
    banks,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!canManageAccounts(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = accountUserCreateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid account data" }, { status: 400 });
  }

  const password = payload.data.password ?? generatePassword();
  const bankId =
    session?.user.role === "BANK_ADMIN"
      ? session.user.bankId
      : payload.data.bankId ?? null;
  const role =
    session?.user.role === "BANK_ADMIN" ? "ACCOUNT" : payload.data.role;

  if (role !== "ADMIN" && !bankId) {
    return NextResponse.json(
      { error: "Bank is required for this account." },
      { status: 400 },
    );
  }

  if (session?.user.role === "BANK_ADMIN" && !bankId) {
    return NextResponse.json(
      { error: "Bank admin account is missing a bank." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        username: payload.data.username,
        fullName: payload.data.fullName,
        role,
        bankId,
        passwordHash,
        isActive: payload.data.isActive,
        accounts:
          role === "ACCOUNT"
            ? {
                create: {
                  accountNo: payload.data.username,
                  bankId,
                },
              }
            : undefined,
      },
      include: { bank: true },
    });

    await logActivity({
      username: session.user.username,
      action: "CREATE_ACCOUNT",
      functionName: "Account management",
      beforeChange: null,
      afterChange: {
        targetUsername: user.username,
        fullName: user.fullName,
        role: user.role,
        bankId: user.bankId,
        isActive: user.isActive,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          bankId: user.bankId,
          bankName: user.bank?.name ?? null,
          isActive: user.isActive,
          resetPasswordRequested: user.resetPasswordRequested,
        },
        temporaryPassword: password,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Username already exists or account could not be created." },
      { status: 409 },
    );
  }
}
