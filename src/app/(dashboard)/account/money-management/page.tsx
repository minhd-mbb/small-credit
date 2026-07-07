import { ArrowDownLeft, ArrowUpRight, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { MoneyTransferForm } from "@/app/(dashboard)/account/money-management/MoneyTransferForm";
import { SpendMoneyForm } from "@/app/(dashboard)/account/money-management/SpendMoneyForm";
import { Card } from "@/components/ui/Card";
import { auth } from "@/lib/auth";
import { formatCompactVnd } from "@/lib/money-format";
import { prisma } from "@/lib/prisma";

function decimalToNumber(value: { toString(): string } | null | undefined) {
  return Number(value?.toString() ?? 0);
}

export default async function MoneyManagementPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ACCOUNT") {
    redirect("/dashboard");
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      type: "CHECKING",
      status: "ACTIVE",
      user: {
        role: "ACCOUNT",
        isActive: true,
      },
    },
    include: {
      user: true,
      bank: true,
    },
  });

  if (!account) {
    return (
      <section className="space-y-5">
        <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Tài khoản
          </p>
          <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
            Quản lý Tiền
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
            Tài khoản đăng nhập hiện chưa có tài khoản thanh toán active để thực hiện chuyển khoản.
          </p>
        </div>
      </section>
    );
  }

  const [latestInflow, latestOutflow] = await Promise.all([
    prisma.transaction.findFirst({
      where: {
        accountId: account.id,
        refType: { in: ["TRANSFER_IN", "DEPOSIT"] },
      },
      orderBy: { txnAt: "desc" },
      select: { amount: true },
    }),
    prisma.transaction.findFirst({
      where: {
        accountId: account.id,
        refType: { in: ["TRANSFER_OUT", "EXPENSE"] },
      },
      orderBy: { txnAt: "desc" },
      select: { amount: true },
    }),
  ]);

  const balance = decimalToNumber(account.balance);
  const latestInflowAmount = decimalToNumber(latestInflow?.amount);
  const latestOutflowAmount = decimalToNumber(latestOutflow?.amount);

  return (
    <section className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Tài khoản
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Quản lý Tiền
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          Theo dõi và thao tác dòng tiền cho tài khoản {account.accountNo}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <WalletCards size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Số dư khả dụng
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                {formatCompactVnd(balance)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <ArrowDownLeft size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Dòng tiền vào
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                {formatCompactVnd(latestInflowAmount)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <ArrowUpRight size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Dòng tiền ra
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                {formatCompactVnd(latestOutflowAmount)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <MoneyTransferForm
        sender={{
          accountNo: account.accountNo,
          fullName: account.user.fullName,
          balance,
        }}
      />

      <SpendMoneyForm
        sender={{
          accountNo: account.accountNo,
          fullName: account.user.fullName,
          balance,
        }}
      />
    </section>
  );
}
