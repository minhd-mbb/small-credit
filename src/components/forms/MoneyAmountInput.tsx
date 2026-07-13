"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import {
  formatCanonicalVndAmount,
  parseLocalizedVndAmount,
  roundVndAmount,
} from "@/lib/money-input";

type MoneyAmountInputProps = {
  label?: string;
  max?: number;
  onChange: (value: string) => void;
  value: string;
};

const STEP = 10_000;

interface AmountInputState {
  canonicalValue: string;
  displayValue: string;
}

export function MoneyAmountInput({
  label = "Số tiền",
  max = 1_000_000_000,
  onChange,
  value,
}: MoneyAmountInputProps) {
  const [inputState, setInputState] = useState<AmountInputState>(() => ({
    canonicalValue: value,
    displayValue: formatCanonicalVndAmount(value),
  }));
  const displayValue =
    inputState.canonicalValue === value
      ? inputState.displayValue
      : formatCanonicalVndAmount(value);
  const numericValue = Number(value || 0);

  function updateAmount(nextValue: number) {
    const clamped = Math.min(Math.max(nextValue, 0), max);
    const rounded = roundVndAmount(clamped);
    const canonicalValue = rounded > 0 ? String(rounded) : "";

    setInputState({
      canonicalValue,
      displayValue: formatCanonicalVndAmount(canonicalValue),
    });
    onChange(canonicalValue);
  }

  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
        {label}
      </span>
      <div className="mt-2 flex h-11 items-center overflow-hidden rounded-xl border border-[var(--border-card)] bg-white transition-all focus-within:border-[var(--primary)]">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-[var(--text-primary)] outline-none"
          inputMode="decimal"
          placeholder="0"
          value={displayValue}
          onChange={(event) => {
            const parsedAmount = parseLocalizedVndAmount(event.target.value);

            if (!parsedAmount) {
              setInputState({ canonicalValue: "", displayValue: "" });
              onChange("");
              return;
            }

            if (parsedAmount.numericValue > max) {
              updateAmount(max);
              return;
            }

            setInputState({
              canonicalValue: parsedAmount.canonicalValue,
              displayValue: parsedAmount.displayValue,
            });
            onChange(parsedAmount.canonicalValue);
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
