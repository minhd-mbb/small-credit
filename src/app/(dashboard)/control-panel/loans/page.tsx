import { redirect } from "next/navigation";
import { LoanManagement } from "@/app/(dashboard)/control-panel/loans/LoanManagement";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type BankRecord = Awaited<ReturnType<typeof prisma.bank.findMany>>[number];
type LoanPolicyRecord = Prisma.LoanInterestPolicyGetPayload<{ include: { bank: true } }>;

export default async function LoanManagementPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "BANK_ADMIN") {
    redirect("/dashboard");
  }

  const where =
    session.user.role === "BANK_ADMIN"
      ? { bankId: session.user.bankId ?? "__missing_bank__" }
      : {};

  const [policies, banks]: [LoanPolicyRecord[], BankRecord[]] = await Promise.all([
    prisma.loanInterestPolicy.findMany({
      where,
      include: { bank: true },
      orderBy: [{ type: "asc" }, { termMonths: "asc" }, { createdAt: "desc" }],
    }),
    session.user.role === "ADMIN"
      ? prisma.bank.findMany({ orderBy: { name: "asc" } })
      : session.user.bankId
        ? prisma.bank.findMany({ where: { id: session.user.bankId } })
        : [],
  ]);

  return (
    <section className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Quản trị
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Quản trị vay
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          Quản lý lãi suất vay theo bank, kỳ hạn và tạo hợp đồng vay.
        </p>
      </div>

      <LoanManagement
        banks={banks.map((bank) => ({ id: bank.id, name: bank.name }))}
        currentBankId={session.user.bankId}
        initialPolicies={policies.map((policy) => ({
          id: policy.id,
          bankId: policy.bankId,
          bankName: policy.bank.name,
          type: policy.type,
          annualRatePercent: policy.annualRatePercent.toString(),
          termMonths: policy.termMonths,
          isActive: policy.isActive,
        }))}
        role={session.user.role}
      />
    </section>
  );
}
