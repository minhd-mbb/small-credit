import { redirect } from "next/navigation";
import { BaseSavingRateManagement } from "@/app/(dashboard)/control-panel/savings/base-rate/BaseSavingRateManagement";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import { SYSTEM_SAVING_BASE_RATE_ID } from "@/lib/savings-policy";

export default async function BaseSavingRatePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/control-panel/savings");
  }

  const [baseRate, bankCount] = await Promise.all([
    prisma.systemSavingBaseRate.findUnique({
      where: { id: SYSTEM_SAVING_BASE_RATE_ID },
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
          Lãi suất cơ bản
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          Thiết lập mức lãi suất tiết kiệm cơ bản cho toàn hệ thống.
        </p>
      </div>

      <BaseSavingRateManagement
        initialRate={baseRate?.annualRatePercent.toString() ?? ""}
        initialUpdatedAt={baseRate?.updatedAt.toISOString() ?? null}
        synchronizedBanks={bankCount}
      />
    </section>
  );
}
