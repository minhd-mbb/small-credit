"use client";

import { BookUser, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export type PickedAccount = {
  id: string;
  accountNo: string;
  fullName: string;
  bankName: string;
};

type AccountPickerScope = "transfer" | "deposit";

type AccountPickerProps = {
  inputValue: string;
  label: string;
  onInputChange: (value: string) => void;
  onSelect: (account: PickedAccount | null) => void;
  scope: AccountPickerScope;
  value: PickedAccount | null;
};

export function accountPickerLabel(account: PickedAccount) {
  return `${account.accountNo} - ${account.fullName} - ${account.bankName}`;
}

export function AccountPicker({
  inputValue,
  label,
  onInputChange,
  onSelect,
  scope,
  value,
}: AccountPickerProps) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResults, setQuickResults] = useState<PickedAccount[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupQuery, setPopupQuery] = useState("");
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupResults, setPopupResults] = useState<PickedAccount[]>([]);

  useEffect(() => {
    if (!quickOpen) {
      return;
    }

    const query = inputValue.trim();

    if (!/^\d{1,20}$/.test(query)) {
      return;
    }

    const controller = new AbortController();

    fetch(
      `/api/account-picker?scope=${scope}&limit=3&q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((payload) => {
        setQuickResults(payload.data ?? []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setQuickResults([]);
        }
      })
      .finally(() => {
        setQuickLoading(false);
      });

    return () => controller.abort();
  }, [inputValue, quickOpen, scope]);

  useEffect(() => {
    if (!popupOpen) {
      return;
    }

    const controller = new AbortController();
    const query = popupQuery.trim();

    fetch(
      `/api/account-picker?scope=${scope}&limit=50&q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((payload) => {
        setPopupResults(payload.data ?? []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setPopupResults([]);
        }
      })
      .finally(() => {
        setPopupLoading(false);
      });

    return () => controller.abort();
  }, [popupOpen, popupQuery, scope]);

  function handleInputChange(nextValue: string) {
    onInputChange(nextValue);
    onSelect(null);

    if (/^\d{1,20}$/.test(nextValue.trim())) {
      setQuickOpen(true);
      setQuickLoading(true);
      return;
    }

    setQuickOpen(false);
    setQuickLoading(false);
    setQuickResults([]);
  }

  function openPopup() {
    setPopupOpen(true);
    setPopupLoading(true);
  }

  function clearSelection() {
    onInputChange("");
    onSelect(null);
    setQuickOpen(false);
    setQuickLoading(false);
    setQuickResults([]);
  }

  function selectAccount(account: PickedAccount) {
    onSelect(account);
    onInputChange(accountPickerLabel(account));
    setQuickOpen(false);
    setQuickLoading(false);
    setQuickResults([]);
    setPopupOpen(false);
    setPopupLoading(false);
  }

  return (
    <>
      <label className="relative block">
        <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
          {label}
        </span>
        <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[var(--border-card)] bg-white px-3 transition-all focus-within:border-[var(--primary)]">
          <Search size={16} className="text-[var(--text-muted)]" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none"
            inputMode="numeric"
            placeholder="Gõ số tài khoản"
            value={inputValue}
            onChange={(event) => handleInputChange(event.target.value)}
          />
          {inputValue || value ? (
            <button
              aria-label="Xóa tài khoản đã chọn"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
              type="button"
              onClick={clearSelection}
            >
              <X size={16} />
            </button>
          ) : null}
          <button
            aria-label="Mở danh bạ tài khoản"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]"
            type="button"
            onClick={openPopup}
          >
            <BookUser size={16} />
          </button>
        </div>

        {quickOpen ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-card)] bg-white shadow-[0_18px_46px_rgba(49,54,49,0.16)]">
            {quickLoading ? (
              <div className="px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                Đang tìm...
              </div>
            ) : null}

            {!quickLoading && quickResults.length === 0 ? (
              <div className="px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                Không có tài khoản phù hợp.
              </div>
            ) : null}

            {quickResults.map((account) => (
              <button
                key={account.id}
                className="flex w-full px-3 py-3 text-left text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--primary-light)]"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectAccount(account);
                }}
              >
                {accountPickerLabel(account)}
              </button>
            ))}
          </div>
        ) : null}
      </label>

      {popupOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4">
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-picker-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="account-picker-title"
                  className="font-display text-lg font-bold text-[var(--color-text)]"
                >
                  Chọn tài khoản
                </h2>
                <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                  Tìm theo số tài khoản, tên hoặc ngân hàng.
                </p>
              </div>
              <button
                aria-label="Đóng popup chọn tài khoản"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--text-primary)]"
                type="button"
                onClick={() => setPopupOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 flex h-11 items-center gap-2 rounded-xl border border-[var(--border-card)] bg-white px-3 transition-all focus-within:border-[var(--primary)]">
              <Search size={16} className="text-[var(--text-muted)]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none"
                placeholder="Tìm tài khoản"
                value={popupQuery}
                onChange={(event) => {
                  setPopupQuery(event.target.value);
                  setPopupLoading(true);
                }}
              />
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-[var(--border-card)]">
              {popupLoading ? (
                <div className="px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                  Đang tìm...
                </div>
              ) : null}

              {!popupLoading && popupResults.length === 0 ? (
                <div className="px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                  Không có tài khoản phù hợp.
                </div>
              ) : null}

              {popupResults.map((account) => (
                <button
                  key={account.id}
                  className={`flex w-full px-3 py-3 text-left text-sm font-bold transition-colors hover:bg-[var(--primary-light)] ${
                    value?.id === account.id
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : "text-[var(--text-primary)]"
                  }`}
                  type="button"
                  onClick={() => selectAccount(account)}
                >
                  {accountPickerLabel(account)}
                </button>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPopupOpen(false)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
