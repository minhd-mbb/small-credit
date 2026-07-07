"use client";

import type { LucideIcon } from "lucide-react";
import {
  BanknoteArrowDown,
  CalendarDays,
  Eye,
  PiggyBank,
  ReceiptText,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MoneyAmountInput } from "@/components/forms/MoneyAmountInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCompactVnd } from "@/lib/money-format";

type SavingHistory = {
  id: string;
  action: string;
  principalChange: number | null;
  interestChange: number | null;
  principalBalanceAfter: number | null;
  note: string | null;
  createdAt: string;
};

type Saving = {
  id: string;
  principalInitial: number;
  principalRemaining: number;
  interestRate: number;
  basicInterestRateAtOpen: number;
  termMonths: number;
  startDate: string;
  maturityDate: string;
  accruedInterest: number;
  status: string;
  closedAt: string | null;
  hasPartialWithdrawal: boolean;
  withdrawals: {
    id: string;
    type: string;
    withdrawPrincipal: number;
    interestPaid: number;
    rateApplied: number;
    balancePrincipalAfter: number;
    withdrawnAt: string;
  }[];
  history: SavingHistory[];
};

type SavingsClientProps = {
  account: {
    accountNo: string;
    balance: number;
    bankName: string;
    fullName: string;
  };
  basicRate: number;
  currentRate: {
    annualRatePercent: number;
    source: string;
  };
  projectedMaturityDates: {
    termMonths: number;
    maturityDate: string;
  }[];
  savings: Saving[];
};

const formatter = new Intl.NumberFormat("vi-VN");
const dateFormatter = new Intl.DateTimeFormat("vi-VN");
const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatVnd(value: number) {
  return `${formatter.format(Math.round(value))} VNĐ`;
}

function daysHeld(startDate: string) {
  const start = new Date(startDate);
  const today = new Date();
  const startDay = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const todayDay = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return Math.max(Math.floor((todayDay - startDay) / 86_400_000), 0);
}

function calculateEarlyInterest(
  amount: number,
  basicRate: number,
  startDate: string,
) {
  return Math.round((amount * basicRate * daysHeld(startDate)) / 100 / 365);
}

function statusLabel(saving: Saving) {
  if (saving.status === "CLOSED") {
    return "Closed";
  }

  if (saving.hasPartialWithdrawal) {
    return "Partial withdrawn";
  }

  return "Active";
}

function historyLabel(action: string) {
  const labels: Record<string, string> = {
    DAILY_ACCRUAL: "Cộng lãi ngày",
    FULL_WITHDRAWAL: "Rút toàn bộ",
    OPEN_SAVING: "Gửi mới",
    PARTIAL_WITHDRAWAL: "Rút một phần",
    RATE_CHANGE: "Đổi lãi suất",
  };

  return labels[action] ?? action;
}

export function SavingsClient({
  account,
  basicRate,
  currentRate,
  projectedMaturityDates,
  savings,
}: SavingsClientProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState(1);
  const [detailSavingId, setDetailSavingId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [confirm, setConfirm] = useState<
    | { type: "OPEN" }
    | { type: "WITHDRAW"; withdrawalType: "PARTIAL" | "FULL" }
    | null
  >(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const detailSaving = savings.find((saving) => saving.id === detailSavingId);
  const activeSavings = savings.filter((saving) => saving.status === "ACTIVE");
  const allHistory = savings
    .flatMap((saving) =>
      saving.history.map((event) => ({
        ...event,
        savingId: saving.id,
      })),
    )
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );

  const stats = useMemo(() => {
    const totalPrincipal = activeSavings.reduce(
      (sum, saving) => sum + saving.principalRemaining,
      0,
    );
    const totalAccrued = activeSavings.reduce(
      (sum, saving) => sum + saving.accruedInterest,
      0,
    );
    const nextMaturity = [...activeSavings].sort(
      (first, second) =>
        new Date(first.maturityDate).getTime() -
        new Date(second.maturityDate).getTime(),
    )[0];
    const highestRate = activeSavings.reduce(
      (highest, saving) => Math.max(highest, saving.interestRate),
      0,
    );

    return { highestRate, nextMaturity, totalAccrued, totalPrincipal };
  }, [activeSavings]);

  const parsedAmount = Number(amount);
  const selectedMaturity = projectedMaturityDates.find(
    (item) => item.termMonths === termMonths,
  );
  const projectedInterest =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Math.round((parsedAmount * currentRate.annualRatePercent * termMonths) / 100 / 12)
      : 0;

  function openError(nextError: string) {
    setMessage("");
    setError(nextError);
  }

  function openDetail(savingId: string) {
    setError("");
    setMessage("");
    setWithdrawAmount("");
    setDetailSavingId(savingId);
  }

  function closeDetail() {
    if (submitting) {
      return;
    }

    setDetailSavingId("");
    setWithdrawAmount("");
    setError("");
  }

  function validateOpenSaving() {
    setMessage("");
    setError("");

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      openError("Số tiền gửi tiết kiệm không hợp lệ.");
      return;
    }

    if (parsedAmount > account.balance) {
      openError("Không đủ số dư tài khoản");
      return;
    }

    if (currentRate.annualRatePercent <= 0) {
      openError("Chưa cấu hình lãi suất tiết kiệm.");
      return;
    }

    setConfirm({ type: "OPEN" });
  }

  async function openSaving() {
    setSubmitting(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/savings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parsedAmount,
        termMonths,
      }),
    });
    const payload = await response.json();

    setSubmitting(false);
    setConfirm(null);

    if (!response.ok) {
      openError(payload.error ?? "Không thể gửi tiết kiệm.");
      return;
    }

    setAmount("");
    setMessage("Đã gửi tiết kiệm thành công.");
    router.refresh();
  }

  function validateWithdrawal(withdrawalType: "PARTIAL" | "FULL") {
    setMessage("");
    setError("");

    if (!detailSaving || detailSaving.status !== "ACTIVE") {
      openError("Khoản tiết kiệm không còn hoạt động.");
      return;
    }

    if (withdrawalType === "PARTIAL") {
      const parsedWithdrawAmount = Number(withdrawAmount);

      if (!Number.isFinite(parsedWithdrawAmount) || parsedWithdrawAmount <= 0) {
        openError("Số tiền rút không hợp lệ.");
        return;
      }

      if (parsedWithdrawAmount >= detailSaving.principalRemaining) {
        openError("Rút một phần cần nhỏ hơn số gốc còn lại.");
        return;
      }
    }

    setConfirm({ type: "WITHDRAW", withdrawalType });
  }

  async function withdrawSaving(withdrawalType: "PARTIAL" | "FULL") {
    if (!detailSaving) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/savings/${detailSaving.id}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: withdrawalType,
        amount: withdrawalType === "PARTIAL" ? Number(withdrawAmount) : undefined,
      }),
    });
    const payload = await response.json();

    setSubmitting(false);
    setConfirm(null);

    if (!response.ok) {
      openError(payload.error ?? "Không thể rút tiết kiệm.");
      return;
    }

    setWithdrawAmount("");
    setDetailSavingId("");
    setMessage(
      withdrawalType === "FULL"
        ? "Đã rút toàn bộ khoản tiết kiệm."
        : "Đã rút một phần khoản tiết kiệm.",
    );
    router.refresh();
  }

  const withdrawPreviewAmount =
    confirm?.type === "WITHDRAW" && detailSaving
      ? confirm.withdrawalType === "FULL"
        ? detailSaving.principalRemaining
        : Number(withdrawAmount)
      : 0;
  const withdrawPreviewInterest =
    detailSaving && withdrawPreviewAmount > 0
      ? calculateEarlyInterest(
          withdrawPreviewAmount,
          detailSaving.basicInterestRateAtOpen,
          detailSaving.startDate,
        )
      : 0;

  return (
    <>
      <section className="min-w-0 space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={PiggyBank}
            label="Tổng tiền đang gửi"
            value={formatCompactVnd(stats.totalPrincipal)}
          />
          <MetricCard
            icon={BanknoteArrowDown}
            label="Tổng lãi tích lũy"
            value={formatCompactVnd(stats.totalAccrued)}
          />
          <MetricCard
            icon={ReceiptText}
            label="Khoản active"
            value={`${activeSavings.length}`}
          />
          <MetricCard
            icon={CalendarDays}
            label="Sắp đáo hạn"
            value={
              stats.nextMaturity
                ? dateFormatter.format(new Date(stats.nextMaturity.maturityDate))
                : "-"
            }
          />
        </div>

        <Card>
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Tài khoản nguồn
              </p>
              <h2 className="font-display mt-2 text-xl font-bold text-[var(--text-primary)]">
                {account.accountNo} - {account.fullName}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="neutral">{account.bankName}</Badge>
                <Badge tone="done">Số dư {formatVnd(account.balance)}</Badge>
                <Badge tone="progress">
                  Lãi suất hiện tại {currentRate.annualRatePercent}%/năm
                </Badge>
                <Badge tone="todo">Cơ bản {basicRate}%/năm</Badge>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <MoneyAmountInput
                label="Số tiền gửi"
                max={Math.min(account.balance, 1_000_000_000)}
                value={amount}
                onChange={setAmount}
              />
              <label className="block">
                <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                  Kỳ hạn
                </span>
                <select
                  className="mt-2 h-11 rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                  value={termMonths}
                  onChange={(event) => setTermMonths(Number(event.target.value))}
                >
                  {[1, 2, 3, 6, 12].map((term) => (
                    <option key={term} value={term}>
                      {term} tháng
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl bg-[var(--primary-light)] px-3 py-3 text-sm font-semibold text-[var(--text-secondary)] md:col-span-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <span>
                    Đáo hạn:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {selectedMaturity
                        ? dateFormatter.format(new Date(selectedMaturity.maturityDate))
                        : "-"}
                    </strong>
                  </span>
                  <span>
                    Lãi dự kiến:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {formatVnd(projectedInterest)}
                    </strong>
                  </span>
                  <span>
                    Tổng nhận:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {formatVnd((parsedAmount || 0) + projectedInterest)}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex justify-end md:col-span-2">
                <Button type="button" onClick={validateOpenSaving}>
                  <PiggyBank size={17} />
                  Gửi tiết kiệm
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {message ? (
          <p className="rounded-xl bg-[var(--status-done)] px-3 py-2 text-sm font-bold text-[var(--status-done-text)]">
            {message}
          </p>
        ) : null}
        {error && !detailSaving ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}

        <Card className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Danh sách khoản tiết kiệm
              </p>
              <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
                {savings.length} khoản
              </h2>
            </div>
            <Badge tone="progress">Cao nhất {stats.highestRate}%/năm</Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-card)]">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
                  {[
                    "Mã",
                    "Gốc còn lại",
                    "Kỳ hạn",
                    "Lãi",
                    "Đáo hạn",
                    "Trạng thái",
                    "",
                  ].map((column) => (
                    <th
                      key={column}
                      className="px-3 py-3 text-xs font-bold uppercase text-[var(--text-muted)]"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {savings.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-sm font-semibold text-[var(--text-secondary)]"
                      colSpan={7}
                    >
                      Chưa có khoản tiết kiệm.
                    </td>
                  </tr>
                ) : (
                  savings.map((saving) => (
                    <tr
                      key={saving.id}
                      className="border-b border-[var(--border-card)] last:border-0 hover:bg-[var(--primary-light)]"
                    >
                      <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                        {saving.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                        {formatVnd(saving.principalRemaining)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                        {saving.termMonths} tháng
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                        {saving.interestRate}%/năm
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                        {dateFormatter.format(new Date(saving.maturityDate))}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={saving.status === "ACTIVE" ? "done" : "neutral"}>
                          {statusLabel(saving)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => openDetail(saving.id)}
                        >
                          <Eye size={16} />
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Lịch sử tiết kiệm
            </p>
            <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
              50 dòng mới nhất
            </h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-card)]">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
                  {["Thời gian", "Khoản", "Hành động", "Gốc thay đổi", "Lãi", "Gốc sau"].map(
                    (column) => (
                      <th
                        key={column}
                        className="px-3 py-3 text-xs font-bold uppercase text-[var(--text-muted)]"
                      >
                        {column}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {allHistory.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-sm font-semibold text-[var(--text-secondary)]"
                      colSpan={6}
                    >
                      Chưa có lịch sử tiết kiệm.
                    </td>
                  </tr>
                ) : (
                  allHistory.slice(0, 50).map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-[var(--border-card)] last:border-0"
                    >
                      <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                        {timeFormatter.format(new Date(event.createdAt))}
                      </td>
                      <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                        {event.savingId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                        {historyLabel(event.action)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                        {event.principalChange === null
                          ? "-"
                          : formatVnd(event.principalChange)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                        {event.interestChange === null
                          ? "-"
                          : formatVnd(event.interestChange)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                        {event.principalBalanceAfter === null
                          ? "-"
                          : formatVnd(event.principalBalanceAfter)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {detailSaving ? (
        <SavingDetailDialog
          error={error}
          saving={detailSaving}
          submitting={submitting}
          withdrawAmount={withdrawAmount}
          onClose={closeDetail}
          onValidateWithdrawal={validateWithdrawal}
          onWithdrawAmountChange={setWithdrawAmount}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          confirm={confirm}
          openAmount={parsedAmount}
          openInterest={projectedInterest}
          selectedMaturity={selectedMaturity?.maturityDate ?? ""}
          selectedSaving={detailSaving}
          submitting={submitting}
          termMonths={termMonths}
          withdrawInterest={withdrawPreviewInterest}
          withdrawPrincipal={withdrawPreviewAmount}
          onClose={() => setConfirm(null)}
          onOpenSaving={openSaving}
          onWithdraw={withdrawSaving}
        />
      ) : null}
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            {label}
          </p>
          <p className="font-display mt-3 break-words text-2xl font-bold text-[var(--text-primary)]">
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border-card)] pb-2 last:border-0">
      <span className="text-sm font-semibold text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="max-w-[60%] break-words text-right text-sm font-bold text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function SavingDetailDialog({
  error,
  onClose,
  onValidateWithdrawal,
  onWithdrawAmountChange,
  saving,
  submitting,
  withdrawAmount,
}: {
  error: string;
  onClose: () => void;
  onValidateWithdrawal: (type: "PARTIAL" | "FULL") => void;
  onWithdrawAmountChange: (value: string) => void;
  saving: Saving;
  submitting: boolean;
  withdrawAmount: string;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4">
      <div
        aria-modal="true"
        className="max-h-[calc(100vh-40px)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]"
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
              Chi tiết khoản tiết kiệm
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
              {saving.id}
            </p>
          </div>
          <button
            aria-label="Đóng popup chi tiết khoản tiết kiệm"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--text-primary)]"
            disabled={submitting}
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <DetailRow label="Gốc ban đầu" value={formatVnd(saving.principalInitial)} />
          <DetailRow label="Gốc còn lại" value={formatVnd(saving.principalRemaining)} />
          <DetailRow label="Lãi tích lũy" value={formatVnd(saving.accruedInterest)} />
          <DetailRow label="Lãi suất" value={`${saving.interestRate}%/năm`} />
          <DetailRow
            label="Lãi cơ bản khi mở"
            value={`${saving.basicInterestRateAtOpen}%/năm`}
          />
          <DetailRow
            label="Ngày gửi"
            value={dateFormatter.format(new Date(saving.startDate))}
          />
          <DetailRow
            label="Ngày đáo hạn"
            value={dateFormatter.format(new Date(saving.maturityDate))}
          />

          {saving.status === "ACTIVE" ? (
            <div className="space-y-3 rounded-xl bg-[var(--primary-light)] p-3">
              <MoneyAmountInput
                label="Số tiền rút một phần"
                max={Math.max(saving.principalRemaining - 1, 0)}
                value={withdrawAmount}
                onChange={onWithdrawAmountChange}
              />

              {error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="grid gap-2 md:grid-cols-2">
                <Button
                  disabled={submitting}
                  type="button"
                  variant="secondary"
                  onClick={() => onValidateWithdrawal("PARTIAL")}
                >
                  Rút một phần
                </Button>
                <Button
                  disabled={submitting}
                  type="button"
                  onClick={() => onValidateWithdrawal("FULL")}
                >
                  Rút toàn bộ
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  confirm,
  openAmount,
  openInterest,
  onClose,
  onOpenSaving,
  onWithdraw,
  selectedMaturity,
  selectedSaving,
  submitting,
  termMonths,
  withdrawInterest,
  withdrawPrincipal,
}: {
  confirm:
    | { type: "OPEN" }
    | { type: "WITHDRAW"; withdrawalType: "PARTIAL" | "FULL" };
  openAmount: number;
  openInterest: number;
  onClose: () => void;
  onOpenSaving: () => void;
  onWithdraw: (type: "PARTIAL" | "FULL") => void;
  selectedMaturity: string;
  selectedSaving?: Saving;
  submitting: boolean;
  termMonths: number;
  withdrawInterest: number;
  withdrawPrincipal: number;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 text-[var(--color-text)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
            {confirm.type === "OPEN"
              ? "Bạn muốn gửi tiết kiệm"
              : confirm.withdrawalType === "FULL"
                ? "Bạn muốn rút toàn bộ"
                : "Bạn muốn rút một phần"}
          </h2>
          <button
            aria-label="Đóng popup xác nhận"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--text-primary)]"
            disabled={submitting}
            type="button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {confirm.type === "OPEN" ? (
          <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--text-secondary)]">
            <p>
              Số tiền:{" "}
              <strong className="text-base text-[var(--text-primary)]">
                {formatVnd(openAmount)}
              </strong>
            </p>
            <p>Kỳ hạn: {termMonths} tháng</p>
            <p>
              Ngày đáo hạn:{" "}
              {selectedMaturity
                ? dateFormatter.format(new Date(selectedMaturity))
                : "-"}
            </p>
            <p>Lãi dự kiến: {formatVnd(openInterest)}</p>
            <p>Sau khi xác nhận, số dư khả dụng sẽ bị trừ số tiền gửi.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--text-secondary)]">
            <p>
              Số tiền gốc rút:{" "}
              <strong className="text-base text-[var(--text-primary)]">
                {formatVnd(withdrawPrincipal)}
              </strong>
            </p>
            <p>Lãi nhận theo lãi suất cơ bản: {formatVnd(withdrawInterest)}</p>
            <p>
              Tổng cộng vào tài khoản:{" "}
              <strong className="text-[var(--text-primary)]">
                {formatVnd(withdrawPrincipal + withdrawInterest)}
              </strong>
            </p>
            {confirm.withdrawalType === "PARTIAL" && selectedSaving ? (
              <p>
                Gốc còn lại tiếp tục gửi:{" "}
                {formatVnd(selectedSaving.principalRemaining - withdrawPrincipal)}
              </p>
            ) : (
              <p>Khoản tiết kiệm sẽ được đóng sau khi xác nhận.</p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button
            disabled={submitting}
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            No
          </Button>
          <Button
            disabled={submitting}
            type="button"
            onClick={() =>
              confirm.type === "OPEN"
                ? onOpenSaving()
                : onWithdraw(confirm.withdrawalType)
            }
          >
            {submitting ? "Đang xử lý" : "Yes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
