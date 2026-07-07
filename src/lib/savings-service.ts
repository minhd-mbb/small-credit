import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SYSTEM_SAVING_BASE_RATE_ID,
} from "@/lib/savings-policy";

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

const DAY_MS = 86_400_000;
const POLICY_PRIORITY = {
  BASIC: 1,
  PERIOD: 2,
  PROMOTIONAL: 3,
} as const;

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function calculateDailyInterestDecimal(
  principal: Prisma.Decimal,
  annualRatePercent: Prisma.Decimal,
) {
  return principal.mul(annualRatePercent).div(100).div(365).toDecimalPlaces(2);
}

export async function resolveCurrentSavingRate(
  bankId: string | null,
  executor: PrismaExecutor = prisma,
) {
  const now = new Date();

  if (!bankId) {
    const systemBase = await executor.systemSavingBaseRate.findUnique({
      where: { id: SYSTEM_SAVING_BASE_RATE_ID },
    });

    return {
      annualRatePercent: systemBase?.annualRatePercent ?? new Prisma.Decimal(0),
      source: "SYSTEM_BASIC",
    };
  }

  const policies = await executor.savingInterestPolicy.findMany({
    where: {
      bankId,
      isActive: true,
      OR: [
        { type: { in: ["BASIC", "PROMOTIONAL"] } },
        {
          type: "PERIOD",
          startDate: { lte: now },
          endDate: { gte: now },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const selected = policies.sort((first, second) => {
    const priorityDiff =
      POLICY_PRIORITY[second.type] - POLICY_PRIORITY[first.type];

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return Number(second.annualRatePercent.sub(first.annualRatePercent));
  })[0];

  if (selected) {
    return {
      annualRatePercent: selected.annualRatePercent,
      source: selected.type,
    };
  }

  const systemBase = await executor.systemSavingBaseRate.findUnique({
    where: { id: SYSTEM_SAVING_BASE_RATE_ID },
  });

  return {
    annualRatePercent: systemBase?.annualRatePercent ?? new Prisma.Decimal(0),
    source: "SYSTEM_BASIC",
  };
}

export async function resolveBasicSavingRate(
  bankId: string | null,
  executor: PrismaExecutor = prisma,
) {
  const bankBasic = bankId
    ? await executor.savingInterestPolicy.findFirst({
        where: {
          bankId,
          type: "BASIC",
          isActive: true,
        },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  if (bankBasic) {
    return bankBasic.annualRatePercent;
  }

  const systemBase = await executor.systemSavingBaseRate.findUnique({
    where: { id: SYSTEM_SAVING_BASE_RATE_ID },
  });

  return systemBase?.annualRatePercent ?? new Prisma.Decimal(0);
}

export async function accrueSavingUntilToday(
  savingId: string,
  executor: PrismaExecutor = prisma,
) {
  const saving = await executor.saving.findUnique({
    where: { id: savingId },
  });

  if (!saving || saving.status !== "ACTIVE") {
    return saving;
  }

  if (saving.principalRemaining.lte(0)) {
    return saving;
  }

  const today = startOfUtcDay();
  const lastAccruedAt = startOfUtcDay(saving.lastAccruedAt ?? saving.startDate);

  if (lastAccruedAt >= today) {
    return saving;
  }

  const days = Math.floor((today.getTime() - lastAccruedAt.getTime()) / DAY_MS);
  let accruedInterest = saving.accruedInterest;
  const accrualRows = [];

  for (let index = 1; index <= days; index += 1) {
    const accrualDate = new Date(lastAccruedAt.getTime() + index * DAY_MS);
    const interestAmount = calculateDailyInterestDecimal(
      saving.principalRemaining,
      saving.interestRate,
    );
    accruedInterest = accruedInterest.plus(interestAmount);

    accrualRows.push({
      savingId: saving.id,
      accrualDate,
      principal: saving.principalRemaining,
      annualRatePercent: saving.interestRate,
      interestAmount,
      accruedInterestAfter: accruedInterest,
    });
  }

  if (accrualRows.length > 0) {
    await executor.savingDailyAccrual.createMany({
      data: accrualRows,
      skipDuplicates: true,
    });
  }

  await executor.savingHistory.create({
    data: {
      savingId: saving.id,
      action: "DAILY_ACCRUAL",
      principalChange: new Prisma.Decimal(0),
      interestChange: accruedInterest.sub(saving.accruedInterest),
      principalBalanceAfter: saving.principalRemaining,
      note: `Accrued ${days} day(s)`,
    },
  });

  return executor.saving.update({
    where: { id: saving.id },
    data: {
      accruedInterest,
      lastAccruedAt: today,
    },
  });
}

export async function accrueActiveSavingsForUser(userId: string) {
  const savings = await prisma.saving.findMany({
    where: {
      status: "ACTIVE",
      account: { userId },
    },
    select: { id: true },
  });

  for (const saving of savings) {
    await accrueSavingUntilToday(saving.id);
  }
}
