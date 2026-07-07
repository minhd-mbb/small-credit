"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

type MoneyAmountInputProps = {
  label?: string;
  max?: number;
  onChange: (value: string) => void;
  value: string;
};

const STEP = 10_000;
const formatter = new Intl.NumberFormat("vi-VN");

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatAmount(value: string) {
  const digits = normalizeDigits(value);

  if (!digits) {
    return "";
  }

  return formatter.format(Number(digits));
}

export function MoneyAmountInput({
  label = "Số tiền",
  max = 1_000_000_000,
  onChange,
  value,
}: MoneyAmountInputProps) {
  const numericValue = Number(normalizeDigits(value) || 0);

  function updateAmount(nextValue: number) {
    const clamped = Math.min(Math.max(nextValue, 0), max);
    onChange(clamped > 0 ? String(clamped) : "");
  }

  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
        {label}
      </span>
      <div className="mt-2 flex h-11 items-center overflow-hidden rounded-xl border border-[var(--border-card)] bg-white transition-all focus-within:border-[var(--primary)]">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-[var(--text-primary)] outline-none"
          inputMode="numeric"
          placeholder="0"
          value={formatAmount(value)}
          onChange={(event) => {
            const digits = normalizeDigits(event.target.value);
            updateAmount(Number(digits || 0));
          }}
        />
        <div className="flex h-full w-8 flex-col border-l border-[var(--border-card)]">
          <button
            aria-label="Tăng số tiền 10000 VNĐ"
            className="flex h-1/2 items-center justify-center text-[var(--text-muted)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]"
            type="button"
            onClick={() => updateAmount(numericValue + STEP)}
          >
            <ChevronUp size={13} />
          </button>
          <button
            aria-label="Giảm số tiền 10000 VNĐ"
            className="flex h-1/2 items-center justify-center border-t border-[var(--border-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)]"
            type="button"
            onClick={() => updateAmount(numericValue - STEP)}
          >
            <ChevronDown size={13} />
          </button>
        </div>
        <span className="flex h-full items-center border-l border-[var(--border-card)] bg-[var(--primary-light)] px-3 text-sm font-bold text-[var(--primary)]">
          VNĐ
        </span>
      </div>
    </label>
  );
}
