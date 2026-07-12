import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import {
  crawlStockQuoteWithPlaywright,
  DEFAULT_STOCK_CRAWLER_SETTING,
  type StockRawResponseLog,
} from "@/lib/stock-playwright-crawler";

export const runtime = "nodejs";
export const maxDuration = 120;

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(
  value: unknown,
  topLevel: true,
): Prisma.InputJsonValue | typeof Prisma.JsonNull;
function toJsonValue(
  value: unknown,
  topLevel?: false,
): Prisma.InputJsonValue | null;
function toJsonValue(
  value: unknown,
  topLevel = true,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | null {
  if (value === null || value === undefined) {
    return topLevel ? Prisma.JsonNull : null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item, false)) as Prisma.InputJsonArray;
  }

  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJsonValue(nested, false)]),
    ) as Prisma.InputJsonObject;
  }

  return String(value);
}

function toJsonInputValue(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const converted = toJsonValue(value, true);
  return converted === null ? Prisma.JsonNull : converted;
}

async function saveRawLogs({
  bankId,
  logs,
  pageUrl,
  symbol,
  userId,
}: {
  bankId: string | null;
  logs: StockRawResponseLog[];
  pageUrl: string;
  symbol: string;
  userId: string;
}) {
  if (logs.length === 0) {
    return;
  }

  await prisma.stockSyncRawLog.createMany({
    data: logs.map((log) => ({
      bankId,
      contentType: log.contentType,
      extracted: log.extracted,
      pageUrl,
      raw: toJsonInputValue(log.raw),
      responseUrl: log.responseUrl,
      status: log.status,
      symbol,
      userId,
    })),
  });
}

export async function POST() {
  const session = await getServerSession();

  if (!session || session.user.role !== "ACCOUNT") {
    return forbidden();
  }

  const items = await prisma.stockWatchlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  const symbols = items.map((item) => item.symbol);

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "Chưa có mã chứng khoán trong danh sách theo dõi." },
      { status: 400 },
    );
  }

  const setting = session.user.bankId
    ? await prisma.stockCrawlerSetting.findUnique({
        where: { bankId: session.user.bankId },
      })
    : null;
  const crawlerSetting = {
    maxRawLogs: setting?.maxRawLogs ?? DEFAULT_STOCK_CRAWLER_SETTING.maxRawLogs,
    timeoutMs: setting?.timeoutMs ?? DEFAULT_STOCK_CRAWLER_SETTING.timeoutMs,
    urlTemplate:
      setting?.urlTemplate ?? DEFAULT_STOCK_CRAWLER_SETTING.urlTemplate,
    waitAfterLoadMs:
      setting?.waitAfterLoadMs ??
      DEFAULT_STOCK_CRAWLER_SETTING.waitAfterLoadMs,
  };
  const syncedSymbols: string[] = [];
  const failedSymbols: { error: string; symbol: string }[] = [];
  const now = new Date();

  for (const symbol of symbols) {
    try {
      const result = await crawlStockQuoteWithPlaywright(symbol, crawlerSetting);
      await saveRawLogs({
        bankId: session.user.bankId,
        logs: result.rawLogs,
        pageUrl: result.pageUrl,
        symbol,
        userId: session.user.id,
      });

      if (result.quote?.price === null || result.quote?.price === undefined) {
        failedSymbols.push({
          symbol,
          error: "Không tìm thấy JSON chứa giá trong các response đã bắt.",
        });
        continue;
      }

      await prisma.stockPriceCache.upsert({
        where: { symbol: result.quote.symbol },
        update: {
          changePercent: result.quote.changePercent,
          companyName: result.quote.companyName,
          price: result.quote.price,
          raw: toJsonInputValue(result.quote.raw),
          source: "PLAYWRIGHT",
          syncedAt: now,
        },
        create: {
          changePercent: result.quote.changePercent,
          companyName: result.quote.companyName,
          price: result.quote.price,
          raw: toJsonInputValue(result.quote.raw),
          source: "PLAYWRIGHT",
          symbol: result.quote.symbol,
          syncedAt: now,
        },
      });
      syncedSymbols.push(result.quote.symbol);
    } catch (error) {
      failedSymbols.push({
        symbol,
        error:
          error instanceof Error
            ? error.message
            : "Không đồng bộ được giá chứng khoán.",
      });
    }
  }

  if (syncedSymbols.length === 0) {
    return NextResponse.json(
      {
        error:
          "Không đồng bộ được mã nào. Hãy kiểm tra cấu hình URL và raw JSON log.",
        failedSymbols,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    failedSymbols,
    syncedAt: now.toISOString(),
    syncedSymbols,
  });
}
