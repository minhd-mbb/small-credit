type StockQuantityInputProps = {
  disabled?: boolean;
  label?: string;
  max?: number;
  value: string;
  onChange: (value: string) => void;
};

export function StockQuantityInput({
  disabled = false,
  label = "Số lượng",
  max,
  onChange,
  value,
}: StockQuantityInputProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
        {label}
      </span>
      <input
        className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        disabled={disabled}
        max={max}
        min={100}
        step={100}
        type="number"
        value={value}
        onChange={(event) => {
          const cleanValue = event.target.value.replace(/[^0-9]/g, "");
          onChange(cleanValue);
        }}
      />
    </label>
  );
}
