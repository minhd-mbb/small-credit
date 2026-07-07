import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TransferInDetail = {
  amount?: unknown;
  accountNo?: unknown;
  from?: {
    accountNo?: unknown;
    fullName?: unknown;
    bankName?: unknown;
  };
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readTransferDetail(value: Prisma.JsonValue): TransferInDetail {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as TransferInDetail;
}

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.activityLog.findMany({
    where: {
      username: session.user.username,
      action: "TRANSFER_IN",
    },
    orderBy: { time: "desc" },
    take: 5,
  });

  return NextResponse.json({
    data: logs.map((log) => {
      const detail = readTransferDetail(log.afterChange);
      const from =
        detail.from && typeof detail.from === "object" ? detail.from : {};

      return {
        id: log.id,
        time: log.time.toISOString(),
        senderName: readString(from.fullName),
        senderAccountNo: readString(from.accountNo),
        senderBankName: readString(from.bankName) || "Không xác định",
        recipientAccountNo: readString(detail.accountNo),
        amount: readString(detail.amount),
      };
    }),
  });
}
