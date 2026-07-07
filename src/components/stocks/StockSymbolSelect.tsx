import { formatStockMoney, toStockUnitPriceVnd } from "@/components/stocks/stock-format";

export type TradableStockOption = {
  symbol: string;
  price: number;
  changePercent: number | null;
  companyName: string | null;
};

type StockSymbolSelectProps = {
  disabled?: boolean;
  label?: string;
  options: TradableStockOption[];
  value: string;
  onChange: (symbol: string) => void;
};

const percentFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function StockSymbolSelect({
  disabled = false,
  label = "Mã chứng khoán",
  onChange,
  options,
  value,
}: StockSymbolSelectProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
        {label}
      </span>
      <select
        className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        disabled={disabled || options.length === 0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Chọn mã</option>
        {options.map((option) => {
          const change =
            option.changePercent === null
              ? ""
              : `, ${option.changePercent > 0 ? "+" : ""}${percentFormatter.format(
                  option.changePercent,
                )}%`;

          return (
            <option key={option.symbol} value={option.symbol}>
              {option.symbol} - {formatStockMoney(toStockUnitPriceVnd(option.price))}
              {change}
            </option>
          );
        })}
      </select>
    </label>
  );
}
