import { redirect } from "next/navigation";
import { BaseLoanRateManagement } from "@/app/(dashboard)/control-panel/loans/base-rate/BaseLoanRateManagement";
import { auth } from "@/lib/auth";
import { SYSTEM_LOAN_BASE_RATE_ID } from "@/lib/loan-policy";
import { prisma } from "@/lib/prisma";

export default async function BaseLoanRatePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/control-panel/loans");
  }

  const [baseRate, bankCount] = await Promise.all([
    prisma.systemLoanBaseRate.findUnique({
      where: { id: SYSTEM_LOAN_BASE_RATE_ID },
    }),
    prisma.bank.count(),
  ]);

  return (
    <section className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Quản trị
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Lãi suất vay cơ bản
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          Thiết lập mức lãi suất vay cơ bản cho toàn hệ thống.
        </p>
      </div>

      <BaseLoanRateManagement
        initialRate={baseRate?.annualRatePercent.toString() ?? ""}
        initialUpdatedAt={baseRate?.updatedAt.toISOString() ?? null}
        synchronizedBanks={bankCount}
      />
    </section>
  );
}
