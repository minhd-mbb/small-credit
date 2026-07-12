import { redirect } from "next/navigation";
import { SavingsClient } from "@/app/(dashboard)/savings/SavingsClient";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import {
  accrueActiveSavingsForUser,
  addMonths,
  resolveBasicSavingRate,
  resolveCurrentSavingRate,
} from "@/lib/savings-service";

export default async function SavingsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ACCOUNT") {
    redirect("/dashboard");
  }

  await accrueActiveSavingsForUser(session.user.id);

  const checkingAccount = await prisma.account.findFirst({
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

  if (!checkingAccount) {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Tiết kiệm
        </h1>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          Không tìm thấy tài khoản thanh toán active để sử dụng tính năng tiết kiệm.
        </p>
      </section>
    );
  }

  const [savings, savingRate, basicRate] = await Promise.all([
    prisma.saving.findMany({
      where: { account: { userId: session.user.id } },
      include: {
        withdrawals: { orderBy: { withdrawnAt: "desc" } },
        historyEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      },
      orderBy: { createdAt: "desc" },
    }),
    resolveCurrentSavingRate(checkingAccount.bankId),
    resolveBasicSavingRate(checkingAccount.bankId),
  ]);

  const now = new Date();

  return (
    <SavingsClient
      account={{
        accountNo: checkingAccount.accountNo,
        balance: Number(checkingAccount.balance.toString()),
        bankName: checkingAccount.bank?.name ?? "All banks",
        fullName: checkingAccount.user.fullName,
      }}
      currentRate={{
        annualRatePercent: Number(savingRate.annualRatePercent.toString()),
        source: savingRate.source,
      }}
      basicRate={Number(basicRate.toString())}
      projectedMaturityDates={[1, 2, 3, 6, 12].map((termMonths) => ({
        termMonths,
        maturityDate: addMonths(now, termMonths).toISOString(),
      }))}
      savings={savings.map((saving) => ({
        id: saving.id,
        principalInitial: Number(saving.principalInitial.toString()),
        principalRemaining: Number(saving.principalRemaining.toString()),
        interestRate: Number(saving.interestRate.toString()),
        basicInterestRateAtOpen: Number(saving.basicInterestRateAtOpen.toString()),
        termMonths: saving.termMonths,
        startDate: saving.startDate.toISOString(),
        maturityDate: saving.maturityDate.toISOString(),
        accruedInterest: Number(saving.accruedInterest.toString()),
        status: saving.status,
        closedAt: saving.closedAt?.toISOString() ?? null,
        hasPartialWithdrawal:
          saving.status === "ACTIVE" &&
          saving.withdrawals.some((withdrawal) => withdrawal.type === "PARTIAL"),
        withdrawals: saving.withdrawals.map((withdrawal) => ({
          id: withdrawal.id,
          type: withdrawal.type,
          withdrawPrincipal: Number(withdrawal.withdrawPrincipal.toString()),
          interestPaid: Number(withdrawal.interestPaid.toString()),
          rateApplied: Number(withdrawal.rateApplied.toString()),
          balancePrincipalAfter: Number(withdrawal.balancePrincipalAfter.toString()),
          withdrawnAt: withdrawal.withdrawnAt.toISOString(),
        })),
        history: saving.historyEvents.map((event) => ({
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
          note: event.note,
          createdAt: event.createdAt.toISOString(),
        })),
      }))}
    />
  );
}
