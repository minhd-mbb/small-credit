import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { accrueLoanUntilToday, startOfUtcDay } from "@/lib/loans-service";
import { prisma } from "@/lib/prisma";
import { loanRateChangeSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (session?.user.role !== "BANK_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = loanRateChangeSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid rate change data" }, { status: 400 });
  }

  const { id } = await context.params;
  const effectiveDate = payload.data.effectiveDate
    ? startOfUtcDay(new Date(payload.data.effectiveDate))
    : startOfUtcDay();

  if (effectiveDate > startOfUtcDay()) {
    return NextResponse.json(
      { error: "Effective date cannot be in the future." },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await accrueLoanUntilToday(id, tx);

    const loan = await tx.loan.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!loan || loan.account.bankId !== session.user.bankId) {
      throw new Error("NOT_FOUND");
    }

    if (loan.status !== "ACTIVE") {
      throw new Error("NOT_ACTIVE");
    }

    const policy = await tx.loanInterestPolicy.findFirst({
      where: {
        bankId: loan.account.bankId ?? "__missing_bank__",
        type: "TERM",
        termMonths: loan.termMonths,
        annualRatePercent: payload.data.annualRatePercent,
        isActive: true,
      },
    });

    if (!policy) {
      throw new Error("INVALID_POLICY_RATE");
    }

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: { interestRate: policy.annualRatePercent },
    });

    await tx.loanRateChange.create({
      data: {
        loanId: loan.id,
        oldRate: loan.interestRate,
        newRate: policy.annualRatePercent,
        effectiveDate,
        changedBy: session.user.username,
      },
    });

    await tx.loanHistory.create({
      data: {
        loanId: loan.id,
        action: "RATE_CHANGE",
        principalChange: null,
        interestChange: null,
        principalBalanceAfter: loan.principalRemaining,
        interestBalanceAfter: loan.accruedInterest,
        note: `${loan.interestRate.toString()}% -> ${policy.annualRatePercent.toString()}%`,
      },
    });

    return { loan, updated };
  });

  await logActivity({
    username: session.user.username,
    action: "UPDATE_LOAN_CONTRACT_RATE",
    functionName: "Loan management",
    beforeChange: {
      loanId: result.loan.id,
      interestRate: result.loan.interestRate.toString(),
    },
    afterChange: {
      loanId: result.updated.id,
      interestRate: result.updated.interestRate.toString(),
      effectiveDate: effectiveDate.toISOString(),
    },
  });

  return NextResponse.json({
    data: {
      loanId: result.updated.id,
      interestRate: result.updated.interestRate.toString(),
    },
  });
}
