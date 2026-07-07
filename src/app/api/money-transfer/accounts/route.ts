import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
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
      userId: { not: session.user.id },
      user: {
        role: "ACCOUNT",
        isActive: true,
      },
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
