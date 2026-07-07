import { redirect } from "next/navigation";
import { LoansClient } from "@/app/(dashboard)/loans/LoansClient";
import { auth } from "@/lib/auth";
import { accrueActiveLoansForUser } from "@/lib/loans-service";
import { prisma } from "@/lib/prisma";

export default async function LoansPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ACCOUNT") {
    redirect("/dashboard");
  }

  await accrueActiveLoansForUser(session.user.id);

  const [account, loans] = await Promise.all([
    prisma.account.findFirst({
      where: {
        userId: session.user.id,
        type: "CHECKING",
        status: "ACTIVE",
        user: { role: "ACCOUNT", isActive: true },
      },
    }),
    prisma.loan.findMany({
      where: { account: { userId: session.user.id } },
      include: {
        repayments: { orderBy: { paidAt: "desc" } },
        historyEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <LoansClient
      accountBalance={Number(account?.balance.toString() ?? 0)}
      loans={loans.map((loan) => ({
        id: loan.id,
        principalInitial: Number(loan.principalInitial.toString()),
        principalRemaining: Number(loan.principalRemaining.toString()),
        accruedInterest: Number(loan.accruedInterest.toString()),
        outstanding: Number(loan.outstanding.toString()),
        interestRate: Number(loan.interestRate.toString()),
        termMonths: loan.termMonths,
        startDate: loan.startDate.toISOString(),
        maturityDate: loan.maturityDate?.toISOString() ?? null,
        status: loan.status,
        repayments: loan.repayments.map((repayment) => ({
          id: repayment.id,
          principalPaid: Number(repayment.principalPaid.toString()),
          interestPaid: Number(repayment.interestPaid.toString()),
          totalPaid: Number(repayment.totalPaid.toString()),
          paidAt: repayment.paidAt.toISOString(),
        })),
        history: loan.historyEvents.map((event) => ({
          id: event.id,
          action: event.action,
          principalChange:
            event.principalChange === null
              ? null
              : Number(event.principalChange.toString()),
          interestChange:
            event.interestChange === null
              ? null
              : Number(event.interestChange.toString()),
          principalBalanceAfter:
            event.principalBalanceAfter === null
              ? null
              : Number(event.principalBalanceAfter.toString()),
          interestBalanceAfter:
            event.interestBalanceAfter === null
              ? null
              : Number(event.interestBalanceAfter.toString()),
          createdAt: event.createdAt.toISOString(),
        })),
      }))}
    />
  );
}
