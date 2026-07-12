import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { accrueLoanUntilToday } from "@/lib/loans-service";
import { prisma } from "@/lib/prisma";
import { loanRepaymentSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (session?.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = loanRepaymentSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid repayment data" }, { status: 400 });
  }

  const { id } = await context.params;
  const paymentAmount = new Prisma.Decimal(payload.data.amount);
  const refId = randomUUID();

  try {
    const result = await prisma.$transaction(async (tx) => {
      await accrueLoanUntilToday(id, tx);

      const loan = await tx.loan.findUnique({
        where: { id },
        include: { account: true },
      });

      if (!loan || loan.account.userId !== session.user.id) {
        throw new Error("NOT_FOUND");
      }

      if (loan.status !== "ACTIVE") {
        throw new Error("NOT_ACTIVE");
      }

      if (loan.account.balance.lt(paymentAmount)) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const totalOutstanding = loan.principalRemaining.plus(loan.accruedInterest);
      const cappedPayment = Prisma.Decimal.min(paymentAmount, totalOutstanding);
      const interestRatio = loan.principalRemaining.gt(0)
        ? loan.accruedInterest.div(loan.principalRemaining)
        : new Prisma.Decimal(0);
      const principalPaid = loan.principalRemaining.lte(0)
        ? new Prisma.Decimal(0)
        : Prisma.Decimal.min(
            cappedPayment.div(new Prisma.Decimal(1).plus(interestRatio)).toDecimalPlaces(2),
            loan.principalRemaining,
          );
      const interestPaid = Prisma.Decimal.min(
        loan.accruedInterest,
        loan.principalRemaining.gt(0)
          ? loan.accruedInterest.mul(principalPaid).div(loan.principalRemaining).toDecimalPlaces(2)
          : cappedPayment,
      );
      const totalPaid = principalPaid.plus(interestPaid);
      const principalAfter = loan.principalRemaining.minus(principalPaid);
      const interestAfter = loan.accruedInterest.minus(interestPaid);
      const isClosed = principalAfter.lte(0) && interestAfter.lte(0);

      const debited = await tx.account.updateMany({
        where: { id: loan.accountId, balance: { gte: totalPaid } },
        data: { balance: { decrement: totalPaid } },
      });

      if (debited.count !== 1) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const updatedAccount = await tx.account.findUniqueOrThrow({
        where: { id: loan.accountId },
      });

      await tx.transaction.create({
        data: {
          accountId: loan.accountId,
          type: "REPAYMENT",
          amount: totalPaid,
          balanceAfter: updatedAccount.balance,
          description: `Loan repayment ${loan.id}`,
          refId,
          refType: "LOAN_REPAYMENT",
          createdBy: session.user.username,
        },
      });

      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          principalRemaining: principalAfter,
          accruedInterest: interestAfter,
          outstanding: principalAfter.plus(interestAfter),
          status: isClosed ? "CLOSED" : "ACTIVE",
          closedAt: isClosed ? new Date() : null,
        },
      });

      await tx.loanRepayment.create({
        data: {
          loanId: loan.id,
          principalPaid,
          interestPaid,
          totalPaid,
          principalBalanceAfter: principalAfter,
          interestBalanceAfter: interestAfter,
          refId,
        },
      });

      await tx.loanHistory.create({
        data: {
          loanId: loan.id,
          action: isClosed ? "FULL_REPAYMENT" : "PARTIAL_REPAYMENT",
          principalChange: principalPaid.neg(),
          interestChange: interestPaid.neg(),
          principalBalanceAfter: principalAfter,
          interestBalanceAfter: interestAfter,
          note: "Repayment allocated to matching accrued interest and principal",
        },
      });

      return {
        loan,
        updatedLoan,
        updatedAccount,
        principalPaid,
        interestPaid,
        totalPaid,
      };
    });

    await logActivity({
      username: session.user.username,
      action: "LOAN_REPAYMENT",
      functionName: "Loans",
      beforeChange: {
        loanId: result.loan.id,
        principalRemaining: result.loan.principalRemaining.toString(),
        accruedInterest: result.loan.accruedInterest.toString(),
      },
      afterChange: {
        refId,
        loanId: result.updatedLoan.id,
        principalPaid: result.principalPaid.toString(),
        interestPaid: result.interestPaid.toString(),
        totalPaid: result.totalPaid.toString(),
        principalRemaining: result.updatedLoan.principalRemaining.toString(),
        accruedInterest: result.updatedLoan.accruedInterest.toString(),
        accountBalance: result.updatedAccount.balance.toString(),
      },
    });

    return NextResponse.json({
      data: {
        refId,
        loanId: result.updatedLoan.id,
        principalPaid: result.principalPaid.toString(),
        interestPaid: result.interestPaid.toString(),
        totalPaid: result.totalPaid.toString(),
        outstanding: result.updatedLoan.outstanding.toString(),
        accountBalance: result.updatedAccount.balance.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Không tìm thấy khoản vay." }, { status: 404 });
      }

      if (error.message === "NOT_ACTIVE") {
        return NextResponse.json({ error: "Khoản vay không còn hoạt động." }, { status: 400 });
      }

      if (error.message === "INSUFFICIENT_BALANCE") {
        return NextResponse.json({ error: "Không đủ số dư tài khoản" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Loan repayment failed." }, { status: 500 });
  }
}
