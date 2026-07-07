import { redirect } from "next/navigation";
import { SavingsManagement } from "@/app/(dashboard)/control-panel/savings/SavingsManagement";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SYSTEM_SAVING_BASE_RATE_ID } from "@/lib/savings-policy";

export default async function SavingsManagementPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "ACCOUNT") {
    redirect("/dashboard");
  }

  const where =
    session.user.role === "BANK_ADMIN"
      ? { bankId: session.user.bankId ?? "__missing_bank__" }
      : {};

  const [policies, banks] = await Promise.all([
    prisma.savingInterestPolicy.findMany({
      where,
      include: { bank: true },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    }),
    session.user.role === "ADMIN"
      ? prisma.bank.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const systemBaseRate = await prisma.systemSavingBaseRate.findUnique({
    where: { id: SYSTEM_SAVING_BASE_RATE_ID },
  });

  return (
    <section className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Quản trị
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Quản trị tiết kiệm
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          Cấu hình lãi suất cơ bản, lãi suất theo thời kỳ và lãi suất ưu đãi.
        </p>
      </div>

      <SavingsManagement
        banks={banks.map((bank) => ({ id: bank.id, name: bank.name }))}
        currentBankId={session.user.bankId}
        initialSystemBaseRate={systemBaseRate?.annualRatePercent.toString() ?? null}
        initialPolicies={policies.map((policy) => ({
          id: policy.id,
          bankId: policy.bankId,
          bankName: policy.bank.name,
          type: policy.type,
          annualRatePercent: policy.annualRatePercent.toString(),
          startDate: policy.startDate?.toISOString() ?? null,
          endDate: policy.endDate?.toISOString() ?? null,
          isActive: policy.isActive,
          createdAt: policy.createdAt.toISOString(),
        }))}
        role={session.user.role}
      />
    </section>
  );
}
