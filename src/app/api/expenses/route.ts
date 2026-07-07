import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = expenseSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid expense data" }, { status: 400 });
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

  const amount = new Prisma.Decimal(payload.data.amount);

  if (sender.balance.lessThan(amount)) {
    return NextResponse.json(
      { error: "Không đủ số dư tài khoản" },
      { status: 400 },
    );
  }

  const refId = randomUUID();
  const description = `${payload.data.withdrawalCategory} - ${payload.data.purpose}`;

  try {
    const updatedSender = await prisma.$transaction(async (tx) => {
      const spent = await tx.account.updateMany({
        where: {
          id: sender.id,
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      if (spent.count !== 1) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const updated = await tx.account.findUniqueOrThrow({
        where: { id: sender.id },
        include: { bank: true, user: true },
      });

      await tx.transaction.create({
        data: {
          accountId: sender.id,
          type: "WITHDRAWAL",
          amount,
          balanceAfter: updated.balance,
          description,
          refId,
          refType: "EXPENSE",
          createdBy: session.user.username,
        },
      });

      return updated;
    });

    await logActivity({
      username: session.user.username,
      action: "WITHDRAWAL",
      functionName: "Money management",
      beforeChange: {
        from: {
          accountNo: sender.accountNo,
          balance: sender.balance.toString(),
        },
      },
      afterChange: {
        amount: amount.toString(),
        purpose: payload.data.purpose,
        withdrawalCategory: payload.data.withdrawalCategory,
        refId,
        from: {
          accountNo: updatedSender.accountNo,
          balance: updatedSender.balance.toString(),
        },
      },
    });

    return NextResponse.json({
      data: {
        refId,
        senderBalance: updatedSender.balance.toString(),
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
      { error: "Expense could not be completed." },
      { status: 500 },
    );
  }
}
