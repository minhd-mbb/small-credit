import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";

function canUseDepositPicker(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

function readLimit(value: string | null) {
  const parsed = Number(value ?? 20);

  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "transfer";
  const query = searchParams.get("q")?.trim() ?? "";
  const limit = readLimit(searchParams.get("limit"));

  if (scope !== "transfer" && scope !== "deposit") {
    return NextResponse.json({ error: "Invalid picker scope" }, { status: 400 });
  }

  if (scope === "deposit" && !canUseDepositPicker(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope === "transfer" && session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Prisma.AccountWhereInput = {
    status: "ACTIVE",
    type: "CHECKING",
    user: {
      role: "ACCOUNT",
      isActive: true,
    },
  };

  if (scope === "transfer") {
    where.userId = { not: session.user.id };
  }

  if (scope === "deposit" && session.user.role === "BANK_ADMIN") {
    where.bankId = session.user.bankId ?? "__missing_bank__";
  }

  if (query) {
    where.OR = [
      { accountNo: { contains: query, mode: "insensitive" } },
      { user: { fullName: { contains: query, mode: "insensitive" } } },
      { bank: { name: { contains: query, mode: "insensitive" } } },
    ];
  }

  const accounts = await prisma.account.findMany({
    where,
    include: {
      bank: true,
      user: true,
    },
    orderBy: [{ accountNo: "asc" }],
    take: limit,
  });

  return NextResponse.json({
    data: accounts.map((account) => ({
      id: account.id,
      accountNo: account.accountNo,
      fullName: account.user.fullName,
      bankName: account.bank?.name ?? "All banks",
    })),
  });
}
