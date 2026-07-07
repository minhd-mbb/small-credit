import { Activity, Building2, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { auth } from "@/lib/auth";

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  BANK_ADMIN: "Bank admin",
  ACCOUNT: "Account",
};

export default async function AccountPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const user = session.user;

  return (
    <section className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Tài khoản
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
          {user.fullName}
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
          Username {user.username}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <UserRound size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Username
              </p>
              <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                {user.username}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Quyền
              </p>
              <div className="mt-1">
                <Badge tone="neutral">{roleLabels[user.role] ?? user.role}</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Bank
              </p>
              <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                {user.bankName ?? "All banks"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
            <Activity size={18} />
          </div>
          <div>
            <p className="font-display text-base font-bold text-[var(--text-primary)]">
              Lịch sử giao dịch
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
              Xem 15 hoạt động mới nhất của tài khoản đang đăng nhập.
            </p>
          </div>
        </div>
        <Link
          href="/account/logs"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--primary-dark)]"
        >
          Mở lịch sử
        </Link>
      </Card>
    </section>
  );
}
