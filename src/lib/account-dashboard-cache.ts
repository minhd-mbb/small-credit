import type { Transaction } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export type AccountDashboardSnapshot = {
  accountNo: string;
  calculatedAt: string;
  expiresAt: string;
  fromCache: boolean;
  income: number;
  expense: number;
  net: number;
  cashflowWeeks: { label: string; income: number; expense: number }[];
  categories: { name: string; amount: number; color: string }[];
  insights: string[];
  attentionTransactions: {
    id: string;
    name: string;
    category: string;
    amount: number;
    status: string;
  }[];
};

const CACHE_TTL_MINUTES = 60;
const CATEGORY_COLORS = [
  "#ef5da8",
  "#f2a93b",
  "#1aa99a",
  "#2f80ed",
  "#9b59b6",
  "#dc3f57",
  "#4ecdc4",
  "#6c63ff",
];

export async function getAccountDashboardSnapshot(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      type: "CHECKING",
      status: "ACTIVE",
      user: {
        role: "ACCOUNT",
        isActive: true,
      },
    },
  });

  if (!account) {
    return null;
  }

  const cached = await readCachedSnapshot(account.id);

  if (cached) {
    return {
      ...cached,
      fromCache: true,
    };
  }

  const snapshot = await calculateSnapshot({
    accountId: account.id,
    accountNo: account.accountNo,
    userId,
  });

  await writeCachedSnapshot(account.id, userId, snapshot);

  return snapshot;
}

async function readCachedSnapshot(accountId: string) {
  try {
    const rows = await prisma.$queryRaw<
      { payload: AccountDashboardSnapshot }[]
    >`
      SELECT payload
      FROM "AccountDashboardCache"
      WHERE "accountId" = ${accountId}
        AND "expiresAt" > NOW()
      LIMIT 1
    `;

    return rows[0]?.payload ?? null;
  } catch {
    return null;
  }
}

async function writeCachedSnapshot(
  accountId: string,
  userId: string,
  snapshot: AccountDashboardSnapshot,
) {
  try {
    const id = randomUUID();
    const payload = JSON.stringify(snapshot);

    await prisma.$executeRaw`
      INSERT INTO "AccountDashboardCache"
        ("id", "accountId", "userId", "payload", "calculatedAt", "expiresAt", "createdAt", "updatedAt")
      VALUES
        (${id}, ${accountId}, ${userId}, ${payload}::jsonb, ${new Date(snapshot.calculatedAt)}, ${new Date(snapshot.expiresAt)}, NOW(), NOW())
      ON CONFLICT ("accountId")
      DO UPDATE SET
        "payload" = EXCLUDED."payload",
        "calculatedAt" = EXCLUDED."calculatedAt",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = NOW()
    `;
  } catch {
    // The dashboard still renders before the cache migration is applied.
  }
}

async function calculateSnapshot({
  accountId,
  accountNo,
}: {
  accountId: string;
  accountNo: string;
  userId: string;
}): Promise<AccountDashboardSnapshot> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMinutes(expiresAt.getMinutes() + CACHE_TTL_MINUTES);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId,
      txnAt: {
        gte: startOfMonth,
      },
    },
    orderBy: { txnAt: "desc" },
  });

  const income = transactions
    .filter(isIncomeTransaction)
    .reduce((sum, transaction) => sum + Number(transaction.amount.toString()), 0);
  const expense = transactions
    .filter(isExpenseTransaction)
    .reduce((sum, transaction) => sum + Number(transaction.amount.toString()), 0);
  const categories = buildCategories(transactions);
  const attentionTransactions = buildAttentionTransactions(transactions);

  return {
    accountNo,
    calculatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    fromCache: false,
    income,
    expense,
    net: income - expense,
    cashflowWeeks: buildCashflowWeeks(transactions, now),
    categories,
    insights: buildInsights({ categories, expense, income, transactions }),
    attentionTransactions,
  };
}

function isIncomeTransaction(transaction: Transaction) {
  return (
    transaction.type === "DEPOSIT" ||
    transaction.type === "INTEREST" ||
    transaction.refType?.includes("TRANSFER_IN") ||
    transaction.refType?.includes("SAVING_WITHDRAWAL")
  );
}

function isExpenseTransaction(transaction: Transaction) {
  return (
    transaction.type === "WITHDRAWAL" ||
    transaction.type === "FEE" ||
    transaction.type === "REPAYMENT" ||
    transaction.refType?.includes("TRANSFER_OUT") ||
    transaction.refType?.includes("STOCK_BUY")
  );
}

function buildCategories(transactions: Transaction[]) {
  const totals = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.type === "WITHDRAWAL")
    .forEach((transaction) => {
      const category = parseWithdrawalCategory(transaction.description);
      const amount = Number(transaction.amount.toString());
      totals.set(category, (totals.get(category) ?? 0) + amount);
    });

  return Array.from(totals.entries())
    .sort((first, second) => second[1] - first[1])
    .slice(0, 8)
    .map(([name, amount], index) => ({
      name,
      amount,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
}

function parseWithdrawalCategory(description: string | null) {
  if (!description) {
    return "Chưa phân loại";
  }

  const [category] = description.split(" - ");
  return category?.trim() || "Chưa phân loại";
}

function buildAttentionTransactions(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => isExpenseTransaction(transaction))
    .slice(0, 6)
    .map((transaction) => {
      const category = parseWithdrawalCategory(transaction.description);
      const amount = Number(transaction.amount.toString());

      return {
        id: transaction.id,
        name: transaction.description ?? transaction.refType ?? transaction.type,
        category,
        amount,
        status:
          category === "Chưa phân loại"
            ? "Cần bổ sung"
            : amount >= 1_000_000
              ? "Chi cao"
              : "Theo dõi",
      };
    });
}

function buildCashflowWeeks(transactions: Transaction[], now: Date) {
  const weeks = Array.from({ length: 4 }, (_, index) => ({
    label: `Tuần ${index + 1}`,
    income: 0,
    expense: 0,
  }));

  for (const transaction of transactions) {
    const weekIndex = Math.min(3, Math.floor((transaction.txnAt.getDate() - 1) / 7));
    const amount = Number(transaction.amount.toString());

    if (isIncomeTransaction(transaction)) {
      weeks[weekIndex].income += amount;
    }

    if (isExpenseTransaction(transaction)) {
      weeks[weekIndex].expense += amount;
    }
  }

  if (now.getDate() <= 7 && transactions.length === 0) {
    return weeks;
  }

  return weeks;
}

function buildInsights({
  categories,
  expense,
  income,
  transactions,
}: {
  categories: { name: string; amount: number }[];
  expense: number;
  income: number;
  transactions: Transaction[];
}) {
  const topCategory = categories[0];
  const unclassified = categories.find((category) => category.name === "Chưa phân loại");
  const insights = [];

  if (topCategory) {
    insights.push(
      `${topCategory.name} là danh mục rút tiền lớn nhất tháng này, chiếm ${Math.round((topCategory.amount / Math.max(expense, 1)) * 100)}% tổng tiền ra.`,
    );
  }

  if (unclassified) {
    insights.push(
      `Có ${formatVnd(unclassified.amount)} giao dịch rút tiền chưa phân loại, cần bổ sung để thống kê chính xác.`,
    );
  }

  insights.push(
    income >= expense
      ? `Dòng tiền tháng này đang dương ${formatVnd(income - expense)}.`
      : `Dòng tiền tháng này đang âm ${formatVnd(expense - income)}.`,
  );

  if (transactions.length === 0) {
    insights.push("Chưa có giao dịch trong tháng này cho tài khoản đăng nhập.");
  }

  return insights.slice(0, 3);
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}
