"use client";

import { Landmark, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { MoneyAmountInput } from "@/components/forms/MoneyAmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCompactVnd } from "@/lib/money-format";

type Fund = {
  id: string;
  type: "SYSTEM" | "BANK";
  bankId: string | null;
  bankName?: string | null;
  name: string;
  balance: string;
};

type FundsManagementProps = {
  banks: { id: string; name: string }[];
  initialFunds: Fund[];
  role: "ADMIN" | "BANK_ADMIN";
};

export function FundsManagement({
  banks,
  initialFunds,
  role,
}: FundsManagementProps) {
  const [funds, setFunds] = useState(initialFunds);
  const [action, setAction] = useState("deposit-system");
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isAdmin = role === "ADMIN";

  async function reloadFunds() {
    const response = await fetch("/api/funds");
    const payload = await response.json();

    if (response.ok) {
      setFunds(payload.data ?? []);
    }
  }

  async function submit() {
    setMessage("");
    setError("");

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Số tiền không hợp lệ.");
      return;
    }

    if (!reason.trim()) {
      setError("Cần nhập lý do.");
      return;
    }

    const response = await fetch(`/api/funds?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parsedAmount,
        reason,
        bankId: action === "deposit-system" ? undefined : bankId,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Không thể thao tác quỹ tiền.");
      return;
    }

    setAmount("");
    setReason("");
    await reloadFunds();
    setMessage("Đã cập nhật quỹ tiền.");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {funds.map((fund) => (
          <Card key={fund.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                  {fund.type === "SYSTEM" ? "Quỹ Tiền tổng" : "Quỹ bank"}
                </p>
                <h2 className="font-display mt-2 text-lg font-bold text-[var(--text-primary)]">
                  {fund.bankName ?? fund.name}
                </h2>
                <p className="mt-3 font-display text-2xl font-bold text-[var(--text-primary)]">
                  {formatCompactVnd(Number(fund.balance))}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <Landmark size={20} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Chức năng
            </span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              {isAdmin ? (
                <option value="deposit-system">Nạp Quỹ Tiền tổng</option>
              ) : null}
              <option value="deposit-bank">
                {isAdmin ? "Nạp Quỹ bank từ Quỹ Tiền tổng" : "Nạp Quỹ bank"}
              </option>
              <option value="withdraw">Rút tiền khỏi quỹ</option>
            </select>
          </label>

          {(action !== "deposit-system" || !isAdmin) && banks.length > 0 ? (
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Bank
              </span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                disabled={!isAdmin}
                value={bankId}
                onChange={(event) => setBankId(event.target.value)}
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <MoneyAmountInput value={amount} onChange={setAmount} />

          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Lý do
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              maxLength={200}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <div className="flex items-end">
            <Button type="button" onClick={submit}>
              {action === "withdraw" ? <Minus size={17} /> : <Plus size={17} />}
              Thực hiện
            </Button>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl bg-[var(--status-done)] px-3 py-2 text-sm font-bold text-[var(--status-done-text)]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
