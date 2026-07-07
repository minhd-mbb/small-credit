"use client";

import { BanknoteArrowUp, HandCoins, ReceiptText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MoneyAmountInput } from "@/components/forms/MoneyAmountInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCompactVnd } from "@/lib/money-format";

type Loan = {
  id: string;
  principalInitial: number;
  principalRemaining: number;
  accruedInterest: number;
  outstanding: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
  maturityDate: string | null;
  status: string;
  repayments: {
    id: string;
    principalPaid: number;
    interestPaid: number;
    totalPaid: number;
    paidAt: string;
  }[];
  history: {
    id: string;
    action: string;
    principalChange: number | null;
    interestChange: number | null;
    principalBalanceAfter: number | null;
    interestBalanceAfter: number | null;
    createdAt: string;
  }[];
};

type LoansClientProps = {
  accountBalance: number;
  loans: Loan[];
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

function historyLabel(action: string) {
  const labels: Record<string, string> = {
    DAILY_ACCRUAL: "Cộng lãi ngày",
    FULL_REPAYMENT: "Tất toán",
    OPEN_LOAN: "Mở khoản vay",
    PARTIAL_REPAYMENT: "Trả nợ một phần",
    RATE_CHANGE: "Đổi lãi suất",
  };

  return labels[action] ?? action;
}

export function LoansClient({ accountBalance, loans }: LoansClientProps) {
  const router = useRouter();
  const [repaymentLoanId, setRepaymentLoanId] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const repaymentLoan = loans.find((loan) => loan.id === repaymentLoanId);
  const activeLoans = loans.filter((loan) => loan.status === "ACTIVE");
  const history = loans
    .flatMap((loan) => loan.history.map((event) => ({ ...event, loanId: loan.id })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const stats = useMemo(() => {
    const totalPrincipal = activeLoans.reduce(
      (sum, loan) => sum + loan.principalRemaining,
      0,
    );
    const totalInterest = activeLoans.reduce(
      (sum, loan) => sum + loan.accruedInterest,
      0,
    );
    const nextDue = [...activeLoans]
      .filter((loan) => loan.maturityDate)
      .sort(
        (a, b) =>
          new Date(a.maturityDate ?? "").getTime() -
          new Date(b.maturityDate ?? "").getTime(),
      )[0];

    return { nextDue, totalInterest, totalPrincipal };
  }, [activeLoans]);

  function openRepaymentPopup(loanId: string) {
    setError("");
    setMessage("");
    setRepayAmount("");
    setRepaymentLoanId(loanId);
  }

  function closeRepaymentPopup() {
    if (submitting) {
      return;
    }

    setRepaymentLoanId("");
    setRepayAmount("");
    setError("");
  }

  async function repayLoan() {
    setMessage("");
    setError("");

    if (!repaymentLoan) {
      setError("Chọn khoản vay cần trả nợ.");
      return;
    }

    const amount = Number(repayAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Số tiền trả nợ không hợp lệ.");
      return;
    }

    if (amount > accountBalance) {
      setError("Không đủ số dư tài khoản");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/loans/${repaymentLoan.id}/repay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Không thể trả nợ.");
      return;
    }

    setRepayAmount("");
    setRepaymentLoanId("");
    setMessage("Đã ghi nhận trả nợ.");
    router.refresh();
  }

  return (
    <section className="min-w-0 space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={HandCoins}
          label="Tổng gốc vay"
          value={formatCompactVnd(stats.totalPrincipal)}
        />
        <MetricCard
          icon={BanknoteArrowUp}
          label="Lãi tích lũy"
          value={formatCompactVnd(stats.totalInterest)}
        />
        <MetricCard
          icon={ReceiptText}
          label="Khoản đến hạn gần nhất"
          value={
            stats.nextDue?.maturityDate
              ? dateFormatter.format(new Date(stats.nextDue.maturityDate))
              : "-"
          }
        />
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--status-done)] px-3 py-2 text-sm font-bold text-[var(--status-done-text)]">
          {message}
        </p>
      ) : null}

      <Card className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Danh sách khoản vay
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
              Chọn nút Trả nợ tại khoản vay active để mở popup thanh toán.
            </p>
          </div>
          <Badge tone="neutral">{loans.length} khoản</Badge>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border-card)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
                {[
                  "Mã",
                  "Gốc còn lại",
                  "Lãi",
                  "Lãi suất",
                  "Kỳ hạn",
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
              {loans.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm font-semibold text-[var(--text-secondary)]"
                    colSpan={7}
                  >
                    Chưa có khoản vay.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr
                    key={loan.id}
                    className="border-b border-[var(--border-card)] last:border-0 hover:bg-[var(--primary-light)]"
                  >
                    <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                      {loan.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {formatVnd(loan.principalRemaining)}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {formatVnd(loan.accruedInterest)}
                    </td>
                    <td className="px-3 py-3 font-semibold">{loan.interestRate}%/năm</td>
                    <td className="px-3 py-3 font-semibold">{loan.termMonths} tháng</td>
                    <td className="px-3 py-3">
                      <Badge tone={loan.status === "ACTIVE" ? "done" : "neutral"}>
                        {loan.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        disabled={loan.status !== "ACTIVE"}
                        type="button"
                        variant="secondary"
                        onClick={() => openRepaymentPopup(loan.id)}
                      >
                        Trả nợ
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
        <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
          Lịch sử vay
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border-card)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
                {["Thời gian", "Khoản", "Hành động", "Gốc", "Lãi"].map((column) => (
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
              {history.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-sm font-semibold text-[var(--text-secondary)]"
                    colSpan={5}
                  >
                    Chưa có lịch sử vay.
                  </td>
                </tr>
              ) : (
                history.slice(0, 50).map((event) => (
                  <tr key={event.id} className="border-b border-[var(--border-card)] last:border-0">
                    <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                      {timeFormatter.format(new Date(event.createdAt))}
                    </td>
                    <td className="px-3 py-3 font-bold">{event.loanId.slice(0, 8)}</td>
                    <td className="px-3 py-3 font-semibold">{historyLabel(event.action)}</td>
                    <td className="px-3 py-3 font-semibold">
                      {event.principalChange === null ? "-" : formatVnd(event.principalChange)}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {event.interestChange === null ? "-" : formatVnd(event.interestChange)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {repaymentLoan ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4">
          <div
            aria-modal="true"
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
                  Trả nợ khoản vay
                </h2>
                <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                  Nhập số tiền muốn thanh toán cho khoản vay đã chọn.
                </p>
              </div>
              <button
                aria-label="Đóng popup trả nợ"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--text-primary)]"
                disabled={submitting}
                type="button"
                onClick={closeRepaymentPopup}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <DetailRow label="Mã khoản" value={repaymentLoan.id} />
              <DetailRow
                label="Gốc còn lại"
                value={formatVnd(repaymentLoan.principalRemaining)}
              />
              <DetailRow
                label="Lãi cần trả"
                value={formatVnd(repaymentLoan.accruedInterest)}
              />
              <DetailRow label="Tổng dư nợ" value={formatVnd(repaymentLoan.outstanding)} />

              <MoneyAmountInput
                label="Số tiền trả"
                max={Math.min(accountBalance, 1_000_000_000)}
                value={repayAmount}
                onChange={setRepayAmount}
              />

              {error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button
                  disabled={submitting}
                  type="button"
                  variant="secondary"
                  onClick={closeRepaymentPopup}
                >
                  Hủy
                </Button>
                <Button disabled={submitting} type="button" onClick={repayLoan}>
                  {submitting ? "Đang xử lý" : "Trả nợ"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HandCoins;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">{label}</p>
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
      <span className="text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      <span className="max-w-[60%] break-words text-right text-sm font-bold text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}
