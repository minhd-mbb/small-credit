import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import {
  accrueSavingUntilToday,
  calculateDailyInterestDecimal,
  startOfUtcDay,
} from "@/lib/savings-service";
import { savingWithdrawalSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function daysHeld(startDate: Date) {
  const today = startOfUtcDay();
  const start = startOfUtcDay(startDate);

  return Math.max(
    Math.floor((today.getTime() - start.getTime()) / 86_400_000),
    0,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = savingWithdrawalSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid withdrawal data" }, { status: 400 });
  }

  const { id } = await context.params;
  const refId = randomUUID();

  try {
    const result = await prisma.$transaction(async (tx) => {
      await accrueSavingUntilToday(id, tx);

      const saving = await tx.saving.findUnique({
        where: { id },
        include: {
          account: {
            include: { bank: true, user: true },
          },
        },
      });

      if (!saving || saving.account.userId !== session.user.id) {
        throw new Error("NOT_FOUND");
      }

      if (saving.status !== "ACTIVE" || saving.principalRemaining.lte(0)) {
        throw new Error("NOT_ACTIVE");
      }

      const requestedAmount =
        payload.data.type === "FULL"
          ? saving.principalRemaining
          : new Prisma.Decimal(payload.data.amount ?? 0);

      if (requestedAmount.lte(0)) {
        throw new Error("INVALID_AMOUNT");
      }

      if (requestedAmount.gt(saving.principalRemaining)) {
        throw new Error("INVALID_AMOUNT");
      }

      const isFullWithdrawal =
        payload.data.type === "FULL" || requestedAmount.eq(saving.principalRemaining);
      const heldDays = daysHeld(saving.startDate);
      const interestPaid = calculateDailyInterestDecimal(
        requestedAmount,
        saving.basicInterestRateAtOpen,
      )
        .mul(heldDays)
        .toDecimalPlaces(2);
      const totalCredit = requestedAmount.plus(interestPaid);
      const withdrawnRatio = saving.principalRemaining.gt(0)
        ? requestedAmount.div(saving.principalRemaining)
        : new Prisma.Decimal(1);
      const accruedInterestAfter = isFullWithdrawal
        ? new Prisma.Decimal(0)
        : saving.accruedInterest
            .minus(saving.accruedInterest.mul(withdrawnRatio))
            .toDecimalPlaces(2);
      const principalAfter = saving.principalRemaining.minus(requestedAmount);

      await tx.account.update({
        where: { id: saving.accountId },
        data: { balance: { increment: totalCredit } },
      });

      const updatedAccount = await tx.account.findUniqueOrThrow({
        where: { id: saving.accountId },
      });

      await tx.transaction.createMany({
        data: [
          {
            accountId: saving.accountId,
            type: "DEPOSIT",
            amount: requestedAmount,
            balanceAfter: updatedAccount.balance.minus(interestPaid),
            description: `Saving principal withdrawal ${saving.id}`,
            refId,
            refType: "SAVING_WITHDRAWAL_PRINCIPAL",
            createdBy: session.user.username,
          },
          {
            accountId: saving.accountId,
            type: "INTEREST",
            amount: interestPaid,
            balanceAfter: updatedAccount.balance,
            description: `Saving early withdrawal interest ${saving.id}`,
            refId,
            refType: "SAVING_WITHDRAWAL_INTEREST",
            createdBy: session.user.username,
          },
        ],
      });

      const updatedSaving = await tx.saving.update({
        where: { id: saving.id },
        data: {
          principalRemaining: principalAfter,
          accruedInterest: accruedInterestAfter,
          status: isFullWithdrawal ? "CLOSED" : "ACTIVE",
          closedAt: isFullWithdrawal ? new Date() : null,
        },
      });

      await tx.savingWithdrawal.create({
        data: {
          savingId: saving.id,
          type: isFullWithdrawal ? "FULL" : "PARTIAL",
          withdrawPrincipal: requestedAmount,
          interestPaid,
          rateApplied: saving.basicInterestRateAtOpen,
          balancePrincipalAfter: principalAfter,
          refId,
        },
      });

      await tx.savingHistory.create({
        data: {
          savingId: saving.id,
          action: isFullWithdrawal ? "FULL_WITHDRAWAL" : "PARTIAL_WITHDRAWAL",
          principalChange: requestedAmount.neg(),
          interestChange: interestPaid,
          principalBalanceAfter: principalAfter,
          note: `${isFullWithdrawal ? "Full" : "Partial"} early withdrawal at ${saving.basicInterestRateAtOpen.toString()}% basic rate`,
        },
      });

      return {
        saving,
        updatedSaving,
        updatedAccount,
        requestedAmount,
        interestPaid,
        totalCredit,
        isFullWithdrawal,
      };
    });

    await logActivity({
      username: session.user.username,
      action: result.isFullWithdrawal ? "FULL_SAVING_WITHDRAWAL" : "PARTIAL_SAVING_WITHDRAWAL",
      functionName: "Savings",
      beforeChange: {
        savingId: result.saving.id,
        principalRemaining: result.saving.principalRemaining.toString(),
        accruedInterest: result.saving.accruedInterest.toString(),
      },
      afterChange: {
        refId,
        savingId: result.updatedSaving.id,
        withdrawPrincipal: result.requestedAmount.toString(),
        interestPaid: result.interestPaid.toString(),
        totalCredit: result.totalCredit.toString(),
        principalRemaining: result.updatedSaving.principalRemaining.toString(),
        accountBalance: result.updatedAccount.balance.toString(),
      },
    });

    return NextResponse.json({
      data: {
        refId,
        savingId: result.updatedSaving.id,
        principalRemaining: result.updatedSaving.principalRemaining.toString(),
        interestPaid: result.interestPaid.toString(),
        totalCredit: result.totalCredit.toString(),
        accountBalance: result.updatedAccount.balance.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Không tìm thấy khoản tiết kiệm." },
          { status: 404 },
        );
      }

      if (error.message === "NOT_ACTIVE") {
        return NextResponse.json(
          { error: "Khoản tiết kiệm không còn hoạt động." },
          { status: 400 },
        );
      }

      if (error.message === "INVALID_AMOUNT") {
        return NextResponse.json(
          { error: "Số tiền rút không hợp lệ." },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Saving withdrawal could not be completed." },
      { status: 500 },
    );
  }
}
