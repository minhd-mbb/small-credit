import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addMonths,
  resolveBasicSavingRate,
  resolveCurrentSavingRate,
  startOfUtcDay,
} from "@/lib/savings-service";
import { savingCreateSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const savings = await prisma.saving.findMany({
    where: { account: { userId: session.user.id } },
    include: {
      account: { include: { bank: true, user: true } },
      historyEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      withdrawals: { orderBy: { withdrawnAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: savings.map((saving) => ({
      id: saving.id,
      accountNo: saving.account.accountNo,
      principalInitial: saving.principalInitial.toString(),
      principalRemaining: saving.principalRemaining.toString(),
      interestRate: saving.interestRate.toString(),
      basicInterestRateAtOpen: saving.basicInterestRateAtOpen.toString(),
      termMonths: saving.termMonths,
      startDate: saving.startDate.toISOString(),
      maturityDate: saving.maturityDate.toISOString(),
      accruedInterest: saving.accruedInterest.toString(),
      status: saving.status,
      closedAt: saving.closedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = savingCreateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid saving data" }, { status: 400 });
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      type: "CHECKING",
      status: "ACTIVE",
      user: {
        role: "ACCOUNT",
        isActive: true,
      },
    },
    include: { bank: true, user: true },
  });

  if (!account) {
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản thanh toán." },
      { status: 404 },
    );
  }

  const amount = new Prisma.Decimal(payload.data.amount);

  if (account.balance.lessThan(amount)) {
    return NextResponse.json(
      { error: "Không đủ số dư tài khoản" },
      { status: 400 },
    );
  }

  const [savingRate, basicRate] = await Promise.all([
    resolveCurrentSavingRate(account.bankId),
    resolveBasicSavingRate(account.bankId),
  ]);

  if (savingRate.annualRatePercent.lte(0)) {
    return NextResponse.json(
      { error: "Chưa cấu hình lãi suất tiết kiệm." },
      { status: 400 },
    );
  }

  const refId = randomUUID();
  const startDate = new Date();
  const maturityDate = addMonths(startDate, payload.data.termMonths);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const debited = await tx.account.updateMany({
        where: {
          id: account.id,
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      if (debited.count !== 1) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const updatedAccount = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });

      const saving = await tx.saving.create({
        data: {
          accountId: account.id,
          principal: amount,
          principalInitial: amount,
          principalRemaining: amount,
          interestRate: savingRate.annualRatePercent,
          basicInterestRateAtOpen: basicRate,
          termMonths: payload.data.termMonths,
          startDate,
          maturityDate,
          accruedInterest: new Prisma.Decimal(0),
          lastAccruedAt: startOfUtcDay(startDate),
          status: "ACTIVE",
        },
      });

      await tx.transaction.create({
        data: {
          accountId: account.id,
          type: "WITHDRAWAL",
          amount,
          balanceAfter: updatedAccount.balance,
          description: `Open saving ${saving.id}`,
          refId,
          refType: "SAVING_DEPOSIT",
          createdBy: session.user.username,
        },
      });

      await tx.savingHistory.create({
        data: {
          savingId: saving.id,
          action: "OPEN_SAVING",
          principalChange: amount,
          interestChange: new Prisma.Decimal(0),
          principalBalanceAfter: amount,
          note: `${payload.data.termMonths} month term at ${savingRate.annualRatePercent.toString()}%`,
        },
      });

      return { saving, updatedAccount };
    });

    await logActivity({
      username: session.user.username,
      action: "OPEN_SAVING",
      functionName: "Savings",
      beforeChange: {
        accountNo: account.accountNo,
        balance: account.balance.toString(),
      },
      afterChange: {
        refId,
        savingId: result.saving.id,
        amount: amount.toString(),
        termMonths: result.saving.termMonths,
        interestRate: result.saving.interestRate.toString(),
        balance: result.updatedAccount.balance.toString(),
      },
    });

    return NextResponse.json(
      {
        data: {
          refId,
          savingId: result.saving.id,
          balance: result.updatedAccount.balance.toString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Không đủ số dư tài khoản" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Saving could not be opened." },
      { status: 500 },
    );
  }
}
