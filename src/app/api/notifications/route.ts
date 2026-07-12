import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TransferInDetail = {
  amount?: string;
  accountNo?: string;
  from?: {
    accountNo?: string;
    fullName?: string;
    bankName?: string;
  };
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readTransferDetail(value: unknown): TransferInDetail {
  if (!isPlainRecord(value)) {
    return {};
  }

  const detail: TransferInDetail = {};

  if (typeof value.amount === "string") {
    detail.amount = value.amount;
  }

  if (typeof value.accountNo === "string") {
    detail.accountNo = value.accountNo;
  }

  if (isPlainRecord(value.from)) {
    detail.from = {
      accountNo:
        typeof value.from.accountNo === "string" ? value.from.accountNo : undefined,
      fullName:
        typeof value.from.fullName === "string" ? value.from.fullName : undefined,
      bankName:
        typeof value.from.bankName === "string" ? value.from.bankName : undefined,
    };
  }

  return detail;
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
