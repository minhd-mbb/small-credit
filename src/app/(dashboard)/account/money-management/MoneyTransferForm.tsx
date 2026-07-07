"use client";

import { SendHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AccountPicker,
  accountPickerLabel,
  type PickedAccount,
} from "@/components/accounts/AccountPicker";
import { MoneyAmountInput } from "@/components/forms/MoneyAmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type MoneyTransferFormProps = {
  sender: {
    accountNo: string;
    fullName: string;
    balance: number;
  };
};

const formatter = new Intl.NumberFormat("vi-VN");

export function MoneyTransferForm({ sender }: MoneyTransferFormProps) {
  const router = useRouter();
  const [accountInput, setAccountInput] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<PickedAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parsedAmount = useMemo(() => Number(amount), [amount]);
  const selectedLabel = selectedAccount ? accountPickerLabel(selectedAccount) : "";

  function openError(message: string) {
    setSuccessMessage("");
    setErrorMessage(message);
  }

  function handleSubmit() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedAccount || accountInput.trim() !== selectedLabel) {
      openError("Số tài khoản không tồn tại.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      openError("Số tiền chuyển khoản không hợp lệ.");
      return;
    }

    if (parsedAmount > 1_000_000_000) {
      openError("Số tiền chuyển khoản không được quá 1.000.000.000 VNĐ.");
      return;
    }

    if (parsedAmount > sender.balance) {
      openError("Không đủ số dư tài khoản");
      return;
    }

    setConfirmOpen(true);
  }

  async function confirmTransfer() {
    if (!selectedAccount) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const response = await fetch("/api/money-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientAccountNo: selectedAccount.accountNo,
        amount: parsedAmount,
      }),
    });
    const payload = await response.json();

    setSubmitting(false);
    setConfirmOpen(false);

    if (!response.ok) {
      openError(payload.error ?? "Transfer could not be completed.");
      return;
    }

    setAmount("");
    setAccountInput("");
    setSelectedAccount(null);
    setSuccessMessage("Chuyển khoản thành công.");
    router.refresh();
  }

  return (
    <>
      <Card>
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Chuyển khoản
          </h2>
          <div className="rounded-xl bg-[var(--primary-light)] px-3 py-2 text-sm font-bold text-[var(--primary)]">
            Số dư: {formatter.format(sender.balance)} VNĐ
          </div>
        </div>

        <div className="grid gap-4">
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Tài khoản chuyển đi
            </span>
            <div className="mt-2 rounded-xl border border-[var(--border-card)] bg-[var(--primary-light)] px-3 py-3 text-sm font-bold text-[var(--text-primary)]">
              {sender.accountNo} - {sender.fullName}
            </div>
          </label>

          <AccountPicker
            inputValue={accountInput}
            label="Tài khoản chuyển tới"
            onInputChange={setAccountInput}
            onSelect={setSelectedAccount}
            scope="transfer"
            value={selectedAccount}
          />

          <MoneyAmountInput value={amount} onChange={setAmount} />

          <div className="flex justify-end">
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              <SendHorizontal size={17} />
              Chuyển khoản
            </Button>
          </div>
        </div>
      </Card>

      {errorMessage ? (
        <AlertDialog tone="error" title={errorMessage} onClose={() => setErrorMessage("")} />
      ) : null}

      {successMessage ? (
        <AlertDialog tone="success" title={successMessage} onClose={() => setSuccessMessage("")} />
      ) : null}

      {confirmOpen && selectedAccount ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 text-[var(--color-text)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
              Bạn muốn chuyển khoản
            </h2>
            <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--text-secondary)]">
              <p>
                Số tiền:{" "}
                <strong className="text-base text-[var(--text-primary)]">
                  {formatter.format(parsedAmount)} VNĐ
                </strong>
              </p>
              <p>
                Tới:{" "}
                <strong className="text-[var(--text-primary)]">
                  {accountPickerLabel(selectedAccount)}
                </strong>
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                No
              </Button>
              <Button type="button" onClick={confirmTransfer} disabled={submitting}>
                {submitting ? "Đang chuyển..." : "Yes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AlertDialog({
  title,
  tone,
  onClose,
}: {
  title: string;
  tone: "error" | "success";
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className={`font-display text-lg font-bold ${tone === "error" ? "text-red-700" : "text-[var(--primary)]"}`}>
            {title}
          </h2>
          <button aria-label="Close popup" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--text-primary)]" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
