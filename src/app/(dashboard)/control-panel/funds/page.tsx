import { redirect } from "next/navigation";
import { FundsManagement } from "@/app/(dashboard)/control-panel/funds/FundsManagement";
import { auth } from "@/lib/auth";
import { ensureBankFund, ensureSystemFund } from "@/lib/funds-service";
import { prisma } from "@/lib/prisma";

export default async function FundsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "BANK_ADMIN") {
    redirect("/dashboard");
  }

  const banks =
    session.user.role === "ADMIN"
      ? await prisma.bank.findMany({ orderBy: { name: "asc" } })
      : session.user.bankId
        ? await prisma.bank.findMany({ where: { id: session.user.bankId } })
        : [];

  if (session.user.role === "ADMIN") {
    await ensureSystemFund();
  }

  for (const bank of banks) {
    await ensureBankFund(bank.id);
  }

  const funds =
    session.user.role === "ADMIN"
      ? await prisma.fund.findMany({
          include: { bank: true },
          orderBy: [{ type: "desc" }, { name: "asc" }],
        })
      : await prisma.fund.findMany({
          where: { bankId: session.user.bankId ?? "__missing_bank__" },
          include: { bank: true },
        });

  return (
    <section className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Quản trị
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Quỹ tiền
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          Quản lý Quỹ Tiền tổng và Quỹ bank.
        </p>
      </div>

      <FundsManagement
        banks={banks.map((bank) => ({ id: bank.id, name: bank.name }))}
        initialFunds={funds.map((fund) => ({
          id: fund.id,
          type: fund.type,
          bankId: fund.bankId,
          bankName: fund.bank?.name ?? null,
          name: fund.name,
          balance: fund.balance.toString(),
        }))}
        role={session.user.role}
      />
    </section>
  );
}
