import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  clampLoanBankBaseRate,
  clampLoanRateToRange,
  roundLoanRate,
  SYSTEM_LOAN_BASE_RATE_ID,
} from "@/lib/loan-policy";
import { startOfUtcDay, addMonths } from "@/lib/savings-service";

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

const DAY_MS = 86_400_000;

export { addMonths, startOfUtcDay };

export function calculateDailyLoanInterestDecimal(
  principal: Prisma.Decimal,
  annualRatePercent: Prisma.Decimal,
) {
  return principal.mul(annualRatePercent).div(100).div(365).toDecimalPlaces(2);
}

export async function resolveSystemLoanBaseRate(
  executor: PrismaExecutor = prisma,
) {
  const rate = await executor.systemLoanBaseRate.findUnique({
    where: { id: SYSTEM_LOAN_BASE_RATE_ID },
  });

  return rate?.annualRatePercent ?? new Prisma.Decimal(0);
}

export async function resolveLoanBankBaseRate(
  bankId: string | null,
  executor: PrismaExecutor = prisma,
) {
  if (bankId) {
    const bankRate = await executor.loanInterestPolicy.findFirst({
      where: { bankId, type: "BASIC", isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (bankRate) {
      return bankRate.annualRatePercent;
    }
  }

  return resolveSystemLoanBaseRate(executor);
}

export async function resolveLoanTermRate({
  bankId,
  termMonths,
  executor = prisma,
}: {
  bankId: string | null;
  termMonths: number;
  executor?: PrismaExecutor;
}) {
  const bankBaseRate = await resolveLoanBankBaseRate(bankId, executor);

  if (!bankId) {
    return {
      annualRatePercent: bankBaseRate,
      bankBaseRate,
      source: "BANK_BASIC",
    };
  }

  const termRate = await executor.loanInterestPolicy.findFirst({
    where: {
      bankId,
      type: "TERM",
      termMonths,
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!termRate) {
    return {
      annualRatePercent: bankBaseRate,
      bankBaseRate,
      source: "BANK_BASIC",
    };
  }

  const normalized = roundLoanRate(
    clampLoanRateToRange(
      Number(termRate.annualRatePercent.toString()),
      Number(bankBaseRate.toString()),
    ),
  );

  return {
    annualRatePercent: new Prisma.Decimal(normalized),
    bankBaseRate,
    source: "TERM",
  };
}

export async function normalizeLoanBankBaseRate(
  requestedRate: number | undefined,
  executor: PrismaExecutor = prisma,
) {
  const systemBaseRate = await resolveSystemLoanBaseRate(executor);
  const normalized = roundLoanRate(
    clampLoanBankBaseRate(
      requestedRate,
      Number(systemBaseRate.toString()),
    ),
  );

  return new Prisma.Decimal(normalized);
}

export async function normalizeLoanTermRate({
  bankId,
  requestedRate,
  executor = prisma,
}: {
  bankId: string;
  requestedRate: number | undefined;
  executor?: PrismaExecutor;
}) {
  const bankBaseRate = await resolveLoanBankBaseRate(bankId, executor);
  const normalized = roundLoanRate(
    clampLoanRateToRange(
      requestedRate,
      Number(bankBaseRate.toString()),
    ),
  );

  return new Prisma.Decimal(normalized);
}

export async function accrueLoanUntilToday(
  loanId: string,
  executor: PrismaExecutor = prisma,
) {
  const loan = await executor.loan.findUnique({ where: { id: loanId } });

  if (!loan || loan.status !== "ACTIVE") {
    return loan;
  }

  if (loan.principalRemaining.lte(0)) {
    return loan;
  }

  const today = startOfUtcDay();
  const lastAccruedAt = startOfUtcDay(
    loan.lastAccruedAt ?? loan.startDate ?? loan.disbursedAt ?? loan.createdAt,
  );

  if (lastAccruedAt >= today) {
    return loan;
  }

  const days = Math.floor((today.getTime() - lastAccruedAt.getTime()) / DAY_MS);
  let accruedInterest = loan.accruedInterest;
  const accrualRows = [];

  for (let index = 1; index <= days; index += 1) {
    const accrualDate = new Date(lastAccruedAt.getTime() + index * DAY_MS);
    const interestAmount = calculateDailyLoanInterestDecimal(
      loan.principalRemaining,
      loan.interestRate,
    );
    accruedInterest = accruedInterest.plus(interestAmount);

    accrualRows.push({
      loanId: loan.id,
      accrualDate,
      principal: loan.principalRemaining,
      annualRatePercent: loan.interestRate,
      interestAmount,
      accruedInterestAfter: accruedInterest,
    });
  }

  if (accrualRows.length > 0) {
    await executor.loanDailyAccrual.createMany({
      data: accrualRows,
      skipDuplicates: true,
    });
  }

  await executor.loanHistory.create({
    data: {
      loanId: loan.id,
      action: "DAILY_ACCRUAL",
      principalChange: new Prisma.Decimal(0),
      interestChange: accruedInterest.sub(loan.accruedInterest),
      principalBalanceAfter: loan.principalRemaining,
      interestBalanceAfter: accruedInterest,
      note: `Accrued ${days} day(s)`,
    },
  });

  return executor.loan.update({
    where: { id: loan.id },
    data: {
      accruedInterest,
      outstanding: loan.principalRemaining.plus(accruedInterest),
      lastAccruedAt: today,
    },
  });
}

export async function accrueActiveLoansForUser(userId: string) {
  const loans = await prisma.loan.findMany({
    where: { status: "ACTIVE", account: { userId } },
    select: { id: true },
  });

  for (const loan of loans) {
    await accrueLoanUntilToday(loan.id);
  }
}
