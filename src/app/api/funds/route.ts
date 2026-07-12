import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { ensureBankFund, ensureSystemFund } from "@/lib/funds-service";
import { prisma } from "@/lib/prisma";
import { fundTransactionSchema } from "@/lib/validations";

function canManageFunds(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

function readTargetBankId(
  role: string,
  sessionBankId: string | null | undefined,
  requestedBankId: string | undefined,
) {
  const bankId = role === "BANK_ADMIN" ? sessionBankId : requestedBankId;

  if (!bankId) {
    throw new Error("BANK_REQUIRED");
  }

  return bankId;
}

export async function GET() {
  const session = await getServerSession();

  if (!canManageFunds(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session?.user.role === "BANK_ADMIN") {
    if (!session.user.bankId) {
      return NextResponse.json({ data: [] });
    }

    const fund = await ensureBankFund(session.user.bankId);

    return NextResponse.json({
      data: [
        {
          id: fund.id,
          type: fund.type,
          bankId: fund.bankId,
          name: fund.name,
          balance: fund.balance.toString(),
        },
      ],
    });
  }

  const systemFund = await ensureSystemFund();
  const banks = await prisma.bank.findMany({ orderBy: { name: "asc" } });

  for (const bank of banks) {
    await ensureBankFund(bank.id);
  }

  const bankFunds = await prisma.fund.findMany({
    where: { type: "BANK" },
    include: { bank: true },
    orderBy: { bank: { name: "asc" } },
  });

  return NextResponse.json({
    data: [
      {
        id: systemFund.id,
        type: systemFund.type,
        bankId: null,
        bankName: null,
        name: systemFund.name,
        balance: systemFund.balance.toString(),
      },
      ...bankFunds.map((fund) => ({
        id: fund.id,
        type: fund.type,
        bankId: fund.bankId,
        bankName: fund.bank?.name ?? null,
        name: fund.name,
        balance: fund.balance.toString(),
      })),
    ],
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!canManageFunds(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = fundTransactionSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid fund data" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const amount = new Prisma.Decimal(payload.data.amount);
  const refId = randomUUID();

  if (action !== "deposit-system" && action !== "deposit-bank" && action !== "withdraw") {
    return NextResponse.json({ error: "Invalid fund action" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (action === "deposit-system") {
        if (session.user.role !== "ADMIN") {
          throw new Error("FORBIDDEN");
        }

        const systemFund = await ensureSystemFund(tx);
        const updated = await tx.fund.update({
          where: { id: systemFund.id },
          data: { balance: { increment: amount } },
        });

        await tx.fundTransaction.create({
          data: {
            fundId: updated.id,
            type: "DEPOSIT_FREE_SOURCE",
            amount,
            balanceAfter: updated.balance,
            reason: payload.data.reason,
            refId,
            createdBy: session.user.username,
          },
        });

        return { fund: updated, type: "DEPOSIT_FREE_SOURCE" };
      }

      if (action === "deposit-bank") {
        const bankId =
          session.user.role === "BANK_ADMIN"
            ? session.user.bankId
            : payload.data.bankId;

        if (!bankId) {
          throw new Error("BANK_REQUIRED");
        }

        const bankFund = await ensureBankFund(bankId, tx);

        if (session.user.role === "ADMIN") {
          const systemFund = await ensureSystemFund(tx);
          const debited = await tx.fund.updateMany({
            where: { id: systemFund.id, balance: { gte: amount } },
            data: { balance: { decrement: amount } },
          });

          if (debited.count !== 1) {
            throw new Error("INSUFFICIENT_FUND");
          }

          const updatedSystem = await tx.fund.findUniqueOrThrow({
            where: { id: systemFund.id },
          });
          await tx.fundTransaction.create({
            data: {
              fundId: systemFund.id,
              type: "TRANSFER_TO_BANK_FUND",
              amount,
              balanceAfter: updatedSystem.balance,
              reason: payload.data.reason,
              refId,
              createdBy: session.user.username,
            },
          });
        }

        const updatedBankFund = await tx.fund.update({
          where: { id: bankFund.id },
          data: { balance: { increment: amount } },
        });

        await tx.fundTransaction.create({
          data: {
            fundId: updatedBankFund.id,
            type:
              session.user.role === "ADMIN"
                ? "RECEIVE_FROM_SYSTEM_FUND"
                : "DEPOSIT_FREE_SOURCE",
            amount,
            balanceAfter: updatedBankFund.balance,
            reason: payload.data.reason,
            refId,
            createdBy: session.user.username,
          },
        });

        return { fund: updatedBankFund, type: "DEPOSIT_BANK" };
      }

      const fund =
        session.user.role === "ADMIN" && !payload.data.bankId
          ? await ensureSystemFund(tx)
          : await ensureBankFund(readTargetBankId(session.user.role, session.user.bankId, payload.data.bankId), tx);

      const debited = await tx.fund.updateMany({
        where: { id: fund.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });

      if (debited.count !== 1) {
        throw new Error("INSUFFICIENT_FUND");
      }

      const updated = await tx.fund.findUniqueOrThrow({ where: { id: fund.id } });
      await tx.fundTransaction.create({
        data: {
          fundId: updated.id,
          type: "WITHDRAW",
          amount,
          balanceAfter: updated.balance,
          reason: payload.data.reason,
          refId,
          createdBy: session.user.username,
        },
      });

      return { fund: updated, type: "WITHDRAW" };
    });

    await logActivity({
      username: session.user.username,
      action: "FUND_TRANSACTION",
      functionName: "Fund management",
      beforeChange: null,
      afterChange: {
        refId,
        type: result.type,
        fundId: result.fund.id,
        amount: amount.toString(),
        balance: result.fund.balance.toString(),
        reason: payload.data.reason,
      },
    });

    return NextResponse.json({ data: { refId, fund: result.fund } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (error.message === "BANK_REQUIRED") {
        return NextResponse.json({ error: "Bank is required." }, { status: 400 });
      }

      if (error.message === "INSUFFICIENT_FUND") {
        return NextResponse.json({ error: "Không đủ số dư quỹ tiền" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Fund transaction failed." }, { status: 500 });
  }
}
