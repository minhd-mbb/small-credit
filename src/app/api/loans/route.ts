import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { auth } from "@/lib/auth";
import { ensureBankFund } from "@/lib/funds-service";
import {
  accrueActiveLoansForUser,
  addMonths,
  resolveLoanBankBaseRate,
  resolveLoanTermRate,
  startOfUtcDay,
} from "@/lib/loans-service";
import { prisma } from "@/lib/prisma";
import { loanCreateSchema } from "@/lib/validations";

function canCreateLoan(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "ACCOUNT") {
    await accrueActiveLoansForUser(session.user.id);
  }

  const where =
    session.user.role === "ACCOUNT"
      ? { account: { userId: session.user.id } }
      : session.user.role === "BANK_ADMIN"
        ? { account: { bankId: session.user.bankId ?? "__missing_bank__" } }
        : {};

  const loans = await prisma.loan.findMany({
    where,
    include: {
      account: { include: { bank: true, user: true } },
      repayments: { orderBy: { paidAt: "desc" } },
      historyEvents: { orderBy: { createdAt: "desc" }, take: 50 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: loans.map((loan) => ({
      id: loan.id,
      accountNo: loan.account.accountNo,
      fullName: loan.account.user.fullName,
      bankName: loan.account.bank?.name ?? "All banks",
      principalInitial: loan.principalInitial.toString(),
      principalRemaining: loan.principalRemaining.toString(),
      accruedInterest: loan.accruedInterest.toString(),
      outstanding: loan.outstanding.toString(),
      interestRate: loan.interestRate.toString(),
      termMonths: loan.termMonths,
      startDate: loan.startDate.toISOString(),
      maturityDate: loan.maturityDate?.toISOString() ?? null,
      status: loan.status,
      closedAt: loan.closedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!canCreateLoan(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = loanCreateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid loan data" }, { status: 400 });
  }

  const recipient = await prisma.account.findFirst({
    where: {
      accountNo: payload.data.recipientAccountNo,
      type: "CHECKING",
      status: "ACTIVE",
      user: { role: "ACCOUNT", isActive: true },
      bankId:
        session?.user.role === "BANK_ADMIN"
          ? session.user.bankId ?? "__missing_bank__"
          : undefined,
    },
    include: { bank: true, user: true },
  });

  if (!recipient || !recipient.bankId) {
    return NextResponse.json(
      { error: "Số tài khoản không tồn tại." },
      { status: 404 },
    );
  }

  const amount = new Prisma.Decimal(payload.data.amount);
  const [loanRate, bankBaseRate] = await Promise.all([
    resolveLoanTermRate({
      bankId: recipient.bankId,
      termMonths: payload.data.termMonths,
    }),
    resolveLoanBankBaseRate(recipient.bankId),
  ]);

  if (loanRate.annualRatePercent.lte(0)) {
    return NextResponse.json(
      { error: "Chưa cấu hình lãi suất vay." },
      { status: 400 },
    );
  }

  const refId = randomUUID();
  const startDate = new Date();
  const maturityDate = addMonths(startDate, payload.data.termMonths);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fund = await ensureBankFund(recipient.bankId!, tx);
      const debitedFund = await tx.fund.updateMany({
        where: { id: fund.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });

      if (debitedFund.count !== 1) {
        throw new Error("INSUFFICIENT_FUND");
      }

      const updatedFund = await tx.fund.findUniqueOrThrow({ where: { id: fund.id } });
      await tx.fundTransaction.create({
        data: {
          fundId: fund.id,
          type: "LOAN_DISBURSEMENT",
          amount,
          balanceAfter: updatedFund.balance,
          reason: `Disburse loan to ${recipient.accountNo}`,
          refId,
          createdBy: session.user.username,
        },
      });

      const updatedAccount = await tx.account.update({
        where: { id: recipient.id },
        data: { balance: { increment: amount } },
      });

      const loan = await tx.loan.create({
        data: {
          userId: recipient.userId,
          accountId: recipient.id,
          principal: amount,
          principalInitial: amount,
          principalRemaining: amount,
          interestRate: loanRate.annualRatePercent,
          basicInterestRateAtOpen: bankBaseRate,
          termMonths: payload.data.termMonths,
          startDate,
          maturityDate,
          disbursedAt: startDate,
          dueDate: maturityDate,
          outstanding: amount,
          accruedInterest: new Prisma.Decimal(0),
          lastAccruedAt: startOfUtcDay(startDate),
          status: "ACTIVE",
          note: payload.data.note,
        },
      });

      await tx.transaction.create({
        data: {
          accountId: recipient.id,
          type: "DEPOSIT",
          amount,
          balanceAfter: updatedAccount.balance,
          description: `Loan disbursement ${loan.id}`,
          refId,
          refType: "LOAN_DISBURSEMENT",
          createdBy: session.user.username,
        },
      });

      await tx.loanHistory.create({
        data: {
          loanId: loan.id,
          action: "OPEN_LOAN",
          principalChange: amount,
          interestChange: new Prisma.Decimal(0),
          principalBalanceAfter: amount,
          interestBalanceAfter: new Prisma.Decimal(0),
          note: `${payload.data.termMonths} month term at ${loan.interestRate.toString()}%`,
        },
      });

      return { loan, updatedAccount, updatedFund };
    });

    await logActivity({
      username: session.user.username,
      action: "OPEN_LOAN",
      functionName: "Loan management",
      beforeChange: null,
      afterChange: {
        refId,
        loanId: result.loan.id,
        accountNo: recipient.accountNo,
        amount: amount.toString(),
        termMonths: result.loan.termMonths,
        interestRate: result.loan.interestRate.toString(),
        accountBalance: result.updatedAccount.balance.toString(),
        fundBalance: result.updatedFund.balance.toString(),
      },
    });

    return NextResponse.json(
      {
        data: {
          refId,
          loanId: result.loan.id,
          accountBalance: result.updatedAccount.balance.toString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_FUND") {
      return NextResponse.json(
        { error: "Không đủ số dư Quỹ bank để giải ngân." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Loan could not be created." },
      { status: 500 },
    );
  }
}
