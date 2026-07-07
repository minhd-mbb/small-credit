import { redirect } from "next/navigation";
import { StockInvestmentsClient } from "@/app/(dashboard)/stock-investments/StockInvestmentsClient";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StockInvestmentsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ACCOUNT") {
    redirect("/dashboard");
  }

  const [account, items, holdings, trades] = await Promise.all([
    prisma.account.findFirst({
      where: {
        status: "ACTIVE",
        type: "CHECKING",
        userId: session.user.id,
        user: { role: "ACCOUNT", isActive: true },
      },
    }),
    prisma.stockWatchlistItem.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.stockHolding.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.stockTrade.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const cacheSymbols = [
    ...new Set([
      ...items.map((item) => item.symbol),
      ...holdings.map((holding) => holding.symbol),
    ]),
  ];
  const caches = await prisma.stockPriceCache.findMany({
    where: { symbol: { in: cacheSymbols } },
  });
  const cacheBySymbol = new Map(caches.map((cache) => [cache.symbol, cache]));

  return (
    <StockInvestmentsClient
      accountBalance={Number(account?.balance.toString() ?? 0)}
      initialItems={items.map((item) => {
        const cache = cacheBySymbol.get(item.symbol);

        return {
          id: item.id,
          symbol: item.symbol,
          companyName: cache?.companyName ?? null,
          price: cache?.price ? Number(cache.price.toString()) : null,
          changePercent: cache?.changePercent
            ? Number(cache.changePercent.toString())
            : null,
          syncedAt: cache?.syncedAt?.toISOString() ?? null,
        };
      })}
      holdings={holdings.map((holding) => {
        const cache = cacheBySymbol.get(holding.symbol);

        return {
          id: holding.id,
          symbol: holding.symbol,
          quantity: holding.quantity,
          averageCostPrice: Number(holding.averageCostPrice.toString()),
          totalCost: Number(holding.totalCost.toString()),
          currentPrice: cache?.price ? Number(cache.price.toString()) : null,
          changePercent: cache?.changePercent
            ? Number(cache.changePercent.toString())
            : null,
        };
      })}
      trades={trades.map((trade) => ({
        id: trade.id,
        type: trade.type,
        symbol: trade.symbol,
        quantity: trade.quantity,
        price: Number(trade.price.toString()),
        grossAmount: Number(trade.grossAmount.toString()),
        feeAmount: Number(trade.feeAmount.toString()),
        netAmount: Number(trade.netAmount.toString()),
        createdAt: trade.createdAt.toISOString(),
      }))}
    />
  );
}
