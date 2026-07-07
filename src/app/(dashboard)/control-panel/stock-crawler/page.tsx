import { redirect } from "next/navigation";
import { StockCrawlerSettings } from "@/app/(dashboard)/control-panel/stock-crawler/StockCrawlerSettings";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STOCK_CRAWLER_SETTING } from "@/lib/stock-playwright-crawler";

export default async function StockCrawlerSettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "BANK_ADMIN" || !session.user.bankId) {
    redirect("/control-panel");
  }

  const setting = await prisma.stockCrawlerSetting.findUnique({
    where: { bankId: session.user.bankId },
  });

  return (
    <StockCrawlerSettings
      initialSetting={{
        maxRawLogs:
          setting?.maxRawLogs ?? DEFAULT_STOCK_CRAWLER_SETTING.maxRawLogs,
        timeoutMs: setting?.timeoutMs ?? DEFAULT_STOCK_CRAWLER_SETTING.timeoutMs,
        urlTemplate:
          setting?.urlTemplate ?? DEFAULT_STOCK_CRAWLER_SETTING.urlTemplate,
        waitAfterLoadMs:
          setting?.waitAfterLoadMs ??
          DEFAULT_STOCK_CRAWLER_SETTING.waitAfterLoadMs,
      }}
    />
  );
}
