import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";

function canDeposit(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!canDeposit(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query && !/^\d{1,20}$/.test(query)) {
    return NextResponse.json({ data: [] });
  }

  const accounts = await prisma.account.findMany({
    where: {
      accountNo: query ? { startsWith: query } : undefined,
      status: "ACTIVE",
      type: "CHECKING",
      user: {
        role: "ACCOUNT",
        isActive: true,
      },
      bankId:
        session?.user.role === "BANK_ADMIN"
          ? session.user.bankId ?? "__missing_bank__"
          : undefined,
    },
    include: {
      bank: true,
      user: true,
    },
    orderBy: { accountNo: "asc" },
    take: 20,
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
