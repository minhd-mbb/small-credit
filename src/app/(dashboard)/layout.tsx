import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@/lib/auth";
import { accrueActiveLoansForUser } from "@/lib/loans-service";
import { prisma } from "@/lib/prisma";
import { accrueActiveSavingsForUser } from "@/lib/savings-service";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "ACCOUNT") {
    await Promise.all([
      accrueActiveSavingsForUser(session.user.id),
      accrueActiveLoansForUser(session.user.id),
    ]);
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
    include: { user: true },
  });
  const transactionWhere = account ? { accountId: account.id } : { accountId: "__none__" };
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const topAccountsWhere =
    session.user.role === "BANK_ADMIN"
      ? {
          type: "CHECKING" as const,
          status: "ACTIVE",
          bankId: session.user.bankId ?? "__none__",
          user: { role: "ACCOUNT" as const, isActive: true },
        }
      : session.user.role === "ACCOUNT"
        ? {
            type: "CHECKING" as const,
            status: "ACTIVE",
            bankId: session.user.bankId ?? "__none__",
            user: { role: "ACCOUNT" as const, isActive: true },
          }
        : {
            type: "CHECKING" as const,
            status: "ACTIVE",
            user: { role: "ACCOUNT" as const, isActive: true },
          };

  const [
    transactions,
    latestTransaction,
    savings,
    totalSavings,
    totalLoans,
    topAccounts,
    stockWatchlistItems,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        ...transactionWhere,
        txnAt: { gte: sevenDaysAgo },
      },
      orderBy: { txnAt: "asc" },
    }),
    prisma.transaction.findFirst({
      where: transactionWhere,
      orderBy: { txnAt: "desc" },
    }),
    prisma.saving.findMany({
      where: {
        account: { userId: session.user.id },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.saving.aggregate({
      where: {
        status: "ACTIVE",
        account: { userId: session.user.id },
      },
      _sum: { principalRemaining: true },
    }),
    prisma.loan.aggregate({
      where: {
        status: "ACTIVE",
        account: { userId: session.user.id },
      },
      _sum: { principalRemaining: true },
    }),
    prisma.account.findMany({
      where: topAccountsWhere,
      include: { user: true },
      orderBy: { balance: "desc" },
      take: 5,
    }),
    prisma.stockWatchlistItem.findMany({
      where: {
        userId: session.user.role === "ACCOUNT" ? session.user.id : "__none__",
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
  ]);
  const stockPriceCaches =
    stockWatchlistItems.length > 0
      ? await prisma.stockPriceCache.findMany({
          where: {
            symbol: { in: stockWatchlistItems.map((item) => item.symbol) },
          },
        })
      : [];
  const stockPriceCacheBySymbol = new Map(
    stockPriceCaches.map((cache) => [cache.symbol, cache]),
  );

  return (
    <AppShell
      user={{
        role: session.user.role,
        username: session.user.username,
        fullName: session.user.fullName,
        bankName: session.user.bankName,
        bankCode: session.user.bankCode,
      }}
      accountSummary={{
        balance: account ? Number(account.balance.toString()) : null,
        roleLabel:
          session.user.role === "ADMIN"
            ? "Admin"
            : session.user.role === "BANK_ADMIN"
              ? "Bank Admin"
              : null,
      }}
      rightPanel={{
        assetSummary: {
          accountBalance: account ? Number(account.balance.toString()) : 0,
          totalSavings: Number(totalSavings._sum.principalRemaining?.toString() ?? 0),
          totalLoans: Number(totalLoans._sum.principalRemaining?.toString() ?? 0),
        },
        balanceSeries: buildBalanceSeries(
          transactions.map((transaction) => ({
            balanceAfter: Number(transaction.balanceAfter.toString()),
            txnAt: transaction.txnAt.toISOString(),
          })),
          account ? Number(account.balance.toString()) : 0,
        ),
        latestCashMovement: latestTransaction
          ? {
              amount: Number(latestTransaction.amount.toString()),
              direction:
                latestTransaction.type === "DEPOSIT" ||
                latestTransaction.type === "INTEREST" ||
                latestTransaction.refType?.includes("TRANSFER_IN") ||
                latestTransaction.refType?.includes("SAVING_WITHDRAWAL")
                  ? "IN"
                  : "OUT",
            }
          : null,
        savings: savings.map((saving) => ({
          id: saving.id,
          principal: Number(saving.principalRemaining.toString()),
          accruedInterest: Number(saving.accruedInterest.toString()),
        })),
        stockPrices: stockWatchlistItems.map((item) => {
          const cache = stockPriceCacheBySymbol.get(item.symbol);

          return {
            id: item.id,
            symbol: item.symbol,
            price: cache?.price ? Number(cache.price.toString()) : null,
            changePercent: cache?.changePercent
              ? Number(cache.changePercent.toString())
              : null,
            syncedAt: cache?.syncedAt?.toISOString() ?? null,
          };
        }),
        topAccounts: topAccounts.map((topAccount) => ({
          accountNo: topAccount.accountNo,
          fullName: topAccount.user.fullName,
          balance: Number(topAccount.balance.toString()),
        })),
      }}
    >
      {children}
    </AppShell>
  );
}

function buildBalanceSeries(
  transactions: { balanceAfter: number; txnAt: string }[],
  fallbackBalance: number,
) {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    date.setHours(23, 59, 59, 999);
    const latestForDay = transactions
      .filter((transaction) => new Date(transaction.txnAt) <= date)
      .at(-1);

    return {
      label: date.toLocaleDateString("vi-VN", { weekday: "short" }),
      value: latestForDay?.balanceAfter ?? fallbackBalance,
    };
  });
}
