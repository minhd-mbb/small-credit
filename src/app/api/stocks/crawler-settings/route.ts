import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STOCK_CRAWLER_SETTING } from "@/lib/stock-playwright-crawler";
import { stockCrawlerSettingSchema } from "@/lib/validations";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "BANK_ADMIN" || !session.user.bankId) {
    return forbidden();
  }

  const setting = await prisma.stockCrawlerSetting.findUnique({
    where: { bankId: session.user.bankId },
  });

  return NextResponse.json({
    data: {
      maxRawLogs: setting?.maxRawLogs ?? DEFAULT_STOCK_CRAWLER_SETTING.maxRawLogs,
      timeoutMs: setting?.timeoutMs ?? DEFAULT_STOCK_CRAWLER_SETTING.timeoutMs,
      urlTemplate:
        setting?.urlTemplate ?? DEFAULT_STOCK_CRAWLER_SETTING.urlTemplate,
      waitAfterLoadMs:
        setting?.waitAfterLoadMs ??
        DEFAULT_STOCK_CRAWLER_SETTING.waitAfterLoadMs,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "BANK_ADMIN" || !session.user.bankId) {
    return forbidden();
  }

  const payload = stockCrawlerSettingSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Cấu hình crawler không hợp lệ." },
      { status: 400 },
    );
  }

  const setting = await prisma.stockCrawlerSetting.upsert({
    where: { bankId: session.user.bankId },
    update: {
      ...payload.data,
      updatedBy: session.user.username,
    },
    create: {
      ...payload.data,
      bankId: session.user.bankId,
      updatedBy: session.user.username,
    },
  });

  return NextResponse.json({ data: setting });
}
