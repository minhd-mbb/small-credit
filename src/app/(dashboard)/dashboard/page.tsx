import { ArrowDownRight, ArrowUpRight, ListChecks, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getAccountDashboardSnapshot } from "@/lib/account-dashboard-cache";
import { auth } from "@/lib/auth";

const formatVnd = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return `${formatVnd.format(value)}đ`;
}

function formatCompact(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(".0", "")}tr`;
  }

  return formatMoney(value);
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ACCOUNT") {
    redirect("/control-panel");
  }

  const snapshot = await getAccountDashboardSnapshot(session.user.id);

  if (!snapshot) {
    return (
      <Card>
        <h1 className="font-display text-xl font-extrabold text-[var(--text-primary)]">
          Chưa có tài khoản thanh toán active
        </h1>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          Dashboard chỉ hiển thị cho user tài khoản có account CHECKING đang hoạt động.
        </p>
      </Card>
    );
  }

  const maxCashflow = Math.max(
    ...snapshot.cashflowWeeks.map((week) => Math.max(week.income, week.expense)),
    1,
  );
  const totalCategoryAmount = snapshot.categories.reduce(
    (sum, category) => sum + category.amount,
    0,
  );
  let donutCurrent = 0;
  const donutGradient =
    snapshot.categories.length > 0
      ? snapshot.categories
          .map((category) => {
            const start = donutCurrent;
            const end = donutCurrent + (category.amount / totalCategoryAmount) * 100;
            donutCurrent = end;
            return `${category.color} ${start}% ${end}%`;
          })
          .join(", ")
      : "#eeeaf7 0% 100%";

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase text-[var(--text-secondary)]">
            Tài khoản {snapshot.accountNo}
          </p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text-primary)]">
            Dashboard sau đăng nhập
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--text-secondary)]">
            Số liệu được tính theo account đăng nhập và cache trong CSDL mỗi 60
            phút. Lần tính gần nhất:{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(snapshot.calculatedAt))}
            .
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-card)] bg-white px-3 py-2 text-sm font-bold text-[var(--text-secondary)] shadow-[var(--shadow-card)]">
          <WalletCards size={17} className="text-[var(--primary)]" />
          {snapshot.fromCache ? "Đang dùng cache" : "Vừa cập nhật"}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase text-[var(--text-secondary)]">
                Tháng này
              </p>
              <h2 className="font-display mt-1 text-lg font-extrabold text-[var(--text-primary)]">
                Dòng tiền tháng này
              </h2>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                snapshot.net >= 0
                  ? "bg-[var(--status-done)] text-[var(--status-done-text)]"
                  : "bg-[#ffe8ec] text-[#dc3f57]"
              }`}
            >
              {snapshot.net >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(snapshot.net))}
            </span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--color-cream)] p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                <ArrowUpRight size={16} className="text-[var(--status-done-text)]" />
                Tiền vào
              </div>
              <p className="mt-2 text-xl font-extrabold text-[var(--text-primary)]">
                {formatMoney(snapshot.income)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--color-cream)] p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                <ArrowDownRight size={16} className="text-[#dc3f57]" />
                Tiền ra
              </div>
              <p className="mt-2 text-xl font-extrabold text-[var(--text-primary)]">
                {formatMoney(snapshot.expense)}
              </p>
            </div>
          </div>

          <div className="grid min-h-48 grid-cols-4 items-end gap-3">
            {snapshot.cashflowWeeks.map((week) => (
              <div key={week.label} className="grid h-48 items-end gap-2">
                <p className="text-center text-xs font-bold text-[var(--text-secondary)]">
                  {formatCompact(Math.max(week.income, week.expense))}
                </p>
                <div className="grid h-32 grid-cols-2 items-end gap-1 overflow-hidden rounded-lg bg-[var(--color-cream)] px-1 pb-0">
                  <div
                    className="w-full rounded-t bg-[var(--chart-blue)]"
                    style={{ height: `${Math.max((week.income / maxCashflow) * 100, week.income ? 4 : 0)}%` }}
                    title={`Tiền vào ${formatMoney(week.income)}`}
                  />
                  <div
                    className="w-full rounded-t bg-[var(--chart-pink)]"
                    style={{ height: `${Math.max((week.expense / maxCashflow) * 100, week.expense ? 4 : 0)}%` }}
                    title={`Tiền ra ${formatMoney(week.expense)}`}
                  />
                </div>
                <p className="text-center text-xs font-bold text-[var(--text-secondary)]">
                  {week.label}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <p className="text-xs font-extrabold uppercase text-[var(--text-secondary)]">
              Từ giao dịch rút tiền
            </p>
            <h2 className="font-display mt-1 text-lg font-extrabold text-[var(--text-primary)]">
              Chi tiêu theo danh mục
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-[170px_minmax(0,1fr)] md:items-center xl:grid-cols-1 2xl:grid-cols-[170px_minmax(0,1fr)]">
            <div
              className="relative h-40 w-40 rounded-full"
              style={{ background: `conic-gradient(${donutGradient})` }}
            >
              <div className="absolute inset-9 grid place-items-center rounded-full bg-white text-center">
                <div>
                  <p className="text-2xl font-extrabold text-[var(--text-primary)]">
                    {formatCompact(totalCategoryAmount)}
                  </p>
                  <p className="text-xs font-bold text-[var(--text-secondary)]">
                    đã rút
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5">
              {snapshot.categories.length === 0 ? (
                <p className="rounded-lg border border-[var(--border-card)] bg-[var(--color-cream)] p-3 text-sm font-semibold text-[var(--text-secondary)]">
                  Chưa có giao dịch rút tiền trong tháng này.
                </p>
              ) : (
                snapshot.categories.map((item) => (
                  <div
                    key={item.name}
                    className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 text-sm"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-[3px]"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate font-bold text-[var(--text-secondary)]">
                      {item.name}
                    </span>
                    <strong className="text-[var(--text-primary)]">
                      {formatCompact(item.amount)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="font-display text-lg font-extrabold text-[var(--text-primary)]">
            Insight cá nhân
          </h2>
          <div className="mt-4 grid gap-2.5">
            {snapshot.insights.map((insight) => (
              <div
                key={insight}
                className="rounded-lg border border-[var(--border-card)] bg-[var(--color-cream)] p-3 text-sm font-semibold leading-5 text-[var(--text-secondary)]"
              >
                {insight}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <ListChecks size={20} className="text-[var(--primary)]" />
            <h2 className="font-display text-lg font-extrabold text-[var(--text-primary)]">
              Giao dịch cần chú ý
            </h2>
          </div>
          <div className="grid gap-2">
            {snapshot.attentionTransactions.length === 0 ? (
              <p className="rounded-lg border border-[var(--border-card)] bg-[var(--color-cream)] p-3 text-sm font-semibold text-[var(--text-secondary)]">
                Chưa có giao dịch cần chú ý trong tháng này.
              </p>
            ) : (
              snapshot.attentionTransactions.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-[var(--border-card)] bg-[var(--color-cream)] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[var(--text-primary)]">
                      {item.name}
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-[var(--text-secondary)]">
                      {item.category} · {item.status}
                    </p>
                  </div>
                  <p className="text-right text-sm font-extrabold text-[var(--text-primary)]">
                    {formatMoney(item.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
