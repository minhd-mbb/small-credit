import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { depositSchema } from "@/lib/validations";

function canDeposit(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

export async function POST(request: Request) {
  const session = await auth();

  if (!canDeposit(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = depositSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid deposit data" }, { status: 400 });
  }

  const recipient = await prisma.account.findFirst({
    where: {
      accountNo: payload.data.recipientAccountNo,
      status: "ACTIVE",
      type: "CHECKING",
      user: {
        role: "ACCOUNT",
        isActive: true,
      },
      bankId:
        session?.user.role === "BANK_ADMIN"
          ? session.user.bankId ?? "__missing_bank__"
          : undefined,
    },
    include: { bank: true, user: true },
  });

  if (!recipient) {
    return NextResponse.json(
      { error: "Số tài khoản không tồn tại." },
      { status: 404 },
    );
  }

  const amount = new Prisma.Decimal(payload.data.amount);
  const refId = randomUUID();

  const updatedRecipient = await prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({
      where: { id: recipient.id },
      data: {
        balance: { increment: amount },
      },
      include: { bank: true, user: true },
    });

    await tx.transaction.create({
      data: {
        accountId: recipient.id,
        type: "DEPOSIT",
        amount,
        balanceAfter: updated.balance,
        description: `Deposit to ${recipient.accountNo}`,
        refId,
        refType: "DEPOSIT",
        createdBy: session.user.username,
      },
    });

    return updated;
  });

  await logActivity({
    username: session.user.username,
    action: "DEPOSIT",
    functionName: "Deposit management",
    beforeChange: {
      to: {
        accountNo: recipient.accountNo,
        balance: recipient.balance.toString(),
      },
    },
    afterChange: {
      amount: amount.toString(),
      refId,
      to: {
        accountNo: updatedRecipient.accountNo,
        fullName: updatedRecipient.user.fullName,
        bankName: updatedRecipient.bank?.name ?? "All banks",
        balance: updatedRecipient.balance.toString(),
      },
    },
  });

  if (updatedRecipient.user.username !== session.user.username) {
    await logActivity({
      username: updatedRecipient.user.username,
      action: "DEPOSIT",
      functionName: "Money management",
      beforeChange: {
        accountNo: recipient.accountNo,
        balance: recipient.balance.toString(),
      },
      afterChange: {
        amount: amount.toString(),
        refId,
        accountNo: updatedRecipient.accountNo,
        balance: updatedRecipient.balance.toString(),
        performedBy: session.user.username,
      },
    });
  }

  return NextResponse.json({
    data: {
      refId,
      recipient: {
        accountNo: updatedRecipient.accountNo,
        fullName: updatedRecipient.user.fullName,
        bankName: updatedRecipient.bank?.name ?? "All banks",
        balance: updatedRecipient.balance.toString(),
      },
    },
  });
}
