"use client";

import { Upload, X } from "lucide-react";
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

const formatter = new Intl.NumberFormat("vi-VN");

export function DepositForm() {
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
      openError("Số tiền nạp không hợp lệ.");
      return;
    }

    if (parsedAmount > 1_000_000_000) {
      openError("Số tiền nạp không được quá 1.000.000.000 VNĐ.");
      return;
    }

    setConfirmOpen(true);
  }

  async function confirmDeposit() {
    if (!selectedAccount) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const response = await fetch("/api/deposits", {
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
      openError(payload.error ?? "Deposit could not be completed.");
      return;
    }

    setAmount("");
    setAccountInput("");
    setSelectedAccount(null);
    setSuccessMessage("Nạp tiền thành công.");
    router.refresh();
  }

  return (
    <>
      <Card>
        <div className="mb-5">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Nạp tiền
          </p>
          <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
            Cộng số dư tài khoản
          </h2>
        </div>

        <div className="grid gap-4">
          <AccountPicker
            inputValue={accountInput}
            label="Tài khoản nhận tiền"
            onInputChange={setAccountInput}
            onSelect={setSelectedAccount}
            scope="deposit"
            value={selectedAccount}
          />

          <MoneyAmountInput value={amount} onChange={setAmount} />

          <div className="flex justify-end">
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              <Upload size={17} />
              Nạp tiền
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
              Bạn muốn nạp tiền
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
              <Button type="button" onClick={confirmDeposit} disabled={submitting}>
                {submitting ? "Đang nạp..." : "Yes"}
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
