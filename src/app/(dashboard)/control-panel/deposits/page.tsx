import { redirect } from "next/navigation";
import { DepositForm } from "@/app/(dashboard)/control-panel/deposits/DepositForm";
import { auth } from "@/lib/auth";

export default async function DepositsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "ACCOUNT") {
    redirect("/dashboard");
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Quản trị
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Nạp tiền
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          {session.user.role === "BANK_ADMIN"
            ? "Nạp tiền cho tài khoản trong phạm vi bank của bạn."
            : "Nạp tiền cho tài khoản active trong hệ thống."}
        </p>
      </div>

      <DepositForm />
    </section>
  );
}
