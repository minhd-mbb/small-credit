import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import { stockWatchlistCreateSchema } from "@/lib/validations";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "ACCOUNT") {
    return forbidden();
  }

  const items = await prisma.stockWatchlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  const caches = await prisma.stockPriceCache.findMany({
    where: { symbol: { in: items.map((item) => item.symbol) } },
  });
  const cacheBySymbol = new Map(caches.map((cache) => [cache.symbol, cache]));

  return NextResponse.json({
    data: items.map((item) => {
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
    }),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "ACCOUNT") {
    return forbidden();
  }

  const payload = stockWatchlistCreateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid stock symbol" }, { status: 400 });
  }

  const count = await prisma.stockWatchlistItem.count({
    where: { userId: session.user.id },
  });

  if (count >= 10) {
    return NextResponse.json(
      { error: "Chỉ được theo dõi tối đa 10 mã chứng khoán." },
      { status: 400 },
    );
  }

  try {
    const item = await prisma.stockWatchlistItem.create({
      data: {
        symbol: payload.data.symbol,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ data: item });
  } catch {
    return NextResponse.json(
      { error: "Mã chứng khoán đã có trong danh sách theo dõi." },
      { status: 409 },
    );
  }
}
