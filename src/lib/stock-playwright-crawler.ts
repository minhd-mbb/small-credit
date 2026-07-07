export type StockCrawlerSettingInput = {
  maxRawLogs: number;
  timeoutMs: number;
  urlTemplate: string;
  waitAfterLoadMs: number;
};

export type CrawledStockQuote = {
  symbol: string;
  companyName: string | null;
  price: number | null;
  changePercent: number | null;
  raw: unknown;
  responseUrl: string;
};

export type StockRawResponseLog = {
  contentType: string | null;
  extracted: boolean;
  raw: unknown;
  responseUrl: string;
  status: number;
};

export const DEFAULT_STOCK_CRAWLER_SETTING: StockCrawlerSettingInput = {
  maxRawLogs: 20,
  timeoutMs: 12_000,
  urlTemplate: "https://finance.vietstock.vn/{symbol}/thong-ke-giao-dich.htm",
  waitAfterLoadMs: 3_000,
};

const PRICE_KEYS = [
  "price",
  "lastprice",
  "matchprice",
  "closeprice",
  "close",
  "basicprice",
  "gia",
  "giakhoplenh",
  "giadongcua",
];
const CHANGE_PERCENT_KEYS = [
  "changepercent",
  "percentchange",
  "pricechangepercent",
  "percentpricechange",
  "perchange",
  "pctchange",
];
const SYMBOL_KEYS = ["symbol", "ticker", "stockcode", "stocksymbol", "code"];
const NAME_KEYS = ["companyname", "organname", "shortname", "fullname", "name"];

function keyMatches(key: string, candidates: string[]) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return candidates.some((candidate) => normalized === candidate);
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const [key, value] of Object.entries(record)) {
    if (!keyMatches(key, keys)) {
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[,%\s]/g, ""));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const [key, value] of Object.entries(record)) {
    if (!keyMatches(key, keys)) {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function collectObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (!value || typeof value !== "object") {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 200)) {
      collectObjects(item, output);
    }

    return output;
  }

  output.push(value as Record<string, unknown>);

  for (const nested of Object.values(value).slice(0, 80)) {
    collectObjects(nested, output);
  }

  return output;
}

function findQuoteInPayload(
  symbol: string,
  payload: unknown,
  responseUrl: string,
): CrawledStockQuote | null {
  const normalizedSymbol = symbol.toUpperCase();
  const objects = collectObjects(payload);

  for (const record of objects) {
    const recordSymbol = readString(record, SYMBOL_KEYS);
    const hasSymbol =
      recordSymbol?.toUpperCase() === normalizedSymbol ||
      JSON.stringify(record).toUpperCase().includes(normalizedSymbol);

    if (!hasSymbol) {
      continue;
    }

    const price = readNumber(record, PRICE_KEYS);

    if (price === null) {
      continue;
    }

    return {
      symbol: normalizedSymbol,
      companyName: readString(record, NAME_KEYS),
      price,
      changePercent: readNumber(record, CHANGE_PERCENT_KEYS),
      raw: payload,
      responseUrl,
    };
  }

  return null;
}

function buildPageUrl(urlTemplate: string, symbol: string) {
  return urlTemplate.replaceAll("{symbol}", encodeURIComponent(symbol.toUpperCase()));
}

export async function crawlStockQuoteWithPlaywright(
  symbol: string,
  setting: StockCrawlerSettingInput,
): Promise<{
  pageUrl: string;
  quote: CrawledStockQuote | null;
  rawLogs: StockRawResponseLog[];
}> {
  const { chromium } = await import("playwright");
  const normalizedSymbol = symbol.toUpperCase();
  const pageUrl = buildPageUrl(setting.urlTemplate, normalizedSymbol);
  const rawLogs: StockRawResponseLog[] = [];
  let quote: CrawledStockQuote | null = null;
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      locale: "vi-VN",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    });

    await context.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();

      if (["font", "image", "media"].includes(resourceType)) {
        await route.abort();
        return;
      }

      await route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(setting.timeoutMs);

    page.on("response", async (response) => {
      const request = response.request();

      if (!["fetch", "xhr"].includes(request.resourceType())) {
        return;
      }

      const headers = response.headers();
      const contentType = headers["content-type"] ?? null;
      const responseUrl = response.url();
      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        return;
      }

      const candidate = findQuoteInPayload(
        normalizedSymbol,
        payload,
        responseUrl,
      );

      if (!quote && candidate) {
        quote = candidate;
      }

      if (rawLogs.length < setting.maxRawLogs || candidate) {
        rawLogs.push({
          contentType,
          extracted: Boolean(candidate),
          raw: payload,
          responseUrl,
          status: response.status(),
        });
      }
    });

    await page.goto(pageUrl, {
      timeout: setting.timeoutMs,
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(setting.waitAfterLoadMs);
    await context.close();
  } finally {
    await browser.close();
  }

  const extractedLogs = rawLogs.filter((log) => log.extracted);
  const normalLogs = rawLogs.filter((log) => !log.extracted);
  const maxRawLogs = Math.max(setting.maxRawLogs, 1);

  return {
    pageUrl,
    quote,
    rawLogs: [...extractedLogs, ...normalLogs].slice(0, maxRawLogs),
  };
}
