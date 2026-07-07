import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

export const SYSTEM_FUND_ID = "SYSTEM_FUND";

export async function ensureSystemFund(executor: PrismaExecutor = prisma) {
  return executor.fund.upsert({
    where: { id: SYSTEM_FUND_ID },
    update: {},
    create: {
      id: SYSTEM_FUND_ID,
      type: "SYSTEM",
      name: "Quỹ Tiền tổng",
      balance: new Prisma.Decimal(0),
    },
  });
}

export async function ensureBankFund(
  bankId: string,
  executor: PrismaExecutor = prisma,
) {
  return executor.fund.upsert({
    where: { bankId },
    update: {},
    create: {
      type: "BANK",
      bankId,
      name: "Quỹ bank",
      balance: new Prisma.Decimal(0),
    },
  });
}
