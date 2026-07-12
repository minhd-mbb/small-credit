import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import { transferSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = transferSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid transfer data" }, { status: 400 });
  }

  const sender = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      type: "CHECKING",
      status: "ACTIVE",
      user: {
        role: "ACCOUNT",
        isActive: true,
      },
    },
    include: { bank: true, user: true },
  });

  if (!sender) {
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản chuyển đi." },
      { status: 404 },
    );
  }

  const recipient = await prisma.account.findUnique({
    where: { accountNo: payload.data.recipientAccountNo },
    include: { bank: true, user: true },
  });

  if (
    !recipient ||
    recipient.status !== "ACTIVE" ||
    recipient.type !== "CHECKING" ||
    recipient.user.role !== "ACCOUNT" ||
    !recipient.user.isActive
  ) {
    return NextResponse.json(
      { error: "Số tài khoản không tồn tại." },
      { status: 404 },
    );
  }

  if (recipient.id === sender.id) {
    return NextResponse.json(
      { error: "Không thể chuyển khoản tới chính tài khoản chuyển đi." },
      { status: 400 },
    );
  }

  const amount = new Prisma.Decimal(payload.data.amount);

  if (sender.balance.lessThan(amount)) {
    return NextResponse.json(
      { error: "Không đủ số dư tài khoản" },
      { status: 400 },
    );
  }

  const refId = randomUUID();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const debited = await tx.account.updateMany({
        where: {
          id: sender.id,
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      if (debited.count !== 1) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.account.update({
        where: { id: recipient.id },
        data: {
          balance: { increment: amount },
        },
      });

      const [updatedSender, updatedRecipient] = await Promise.all([
        tx.account.findUniqueOrThrow({
          where: { id: sender.id },
          include: { bank: true, user: true },
        }),
        tx.account.findUniqueOrThrow({
          where: { id: recipient.id },
          include: { bank: true, user: true },
        }),
      ]);

      await tx.transaction.createMany({
        data: [
          {
            accountId: sender.id,
            type: "TRANSFER",
            amount,
            balanceAfter: updatedSender.balance,
            description: `Transfer to ${recipient.accountNo}`,
            refId,
            refType: "TRANSFER_OUT",
            createdBy: session.user.username,
          },
          {
            accountId: recipient.id,
            type: "TRANSFER",
            amount,
            balanceAfter: updatedRecipient.balance,
            description: `Transfer from ${sender.accountNo}`,
            refId,
            refType: "TRANSFER_IN",
            createdBy: session.user.username,
          },
        ],
      });

      return { updatedSender, updatedRecipient };
    });

    await logActivity({
      username: session.user.username,
      action: "TRANSFER",
      functionName: "Money management",
      beforeChange: {
        from: {
          accountNo: sender.accountNo,
          balance: sender.balance.toString(),
        },
        to: {
          accountNo: recipient.accountNo,
          balance: recipient.balance.toString(),
        },
      },
      afterChange: {
        amount: amount.toString(),
        refId,
        from: {
          accountNo: result.updatedSender.accountNo,
          balance: result.updatedSender.balance.toString(),
        },
        to: {
          accountNo: result.updatedRecipient.accountNo,
          fullName: result.updatedRecipient.user.fullName,
          bankName: result.updatedRecipient.bank?.name ?? "All banks",
          balance: result.updatedRecipient.balance.toString(),
        },
      },
    });

    if (result.updatedRecipient.user.username !== session.user.username) {
      await logActivity({
        username: result.updatedRecipient.user.username,
        action: "TRANSFER_IN",
        functionName: "Money management",
        beforeChange: {
          accountNo: recipient.accountNo,
          balance: recipient.balance.toString(),
        },
        afterChange: {
          amount: amount.toString(),
          refId,
          from: {
            accountNo: sender.accountNo,
            fullName: sender.user.fullName,
            bankName: sender.bank?.name ?? "All banks",
          },
          accountNo: result.updatedRecipient.accountNo,
          balance: result.updatedRecipient.balance.toString(),
        },
      });
    }

    return NextResponse.json({
      data: {
        refId,
        senderBalance: result.updatedSender.balance.toString(),
        recipient: {
          accountNo: result.updatedRecipient.accountNo,
          fullName: result.updatedRecipient.user.fullName,
          bankName: result.updatedRecipient.bank?.name ?? "All banks",
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Không đủ số dư tài khoản" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Transfer could not be completed." },
      { status: 500 },
    );
  }
}
