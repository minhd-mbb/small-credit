import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatStockMoney } from "@/components/stocks/stock-format";

type TradeConfirmDialogProps = {
  feeAmount: number;
  grossAmount: number;
  netAmount: number;
  price: number;
  quantity: number;
  submitting: boolean;
  symbol: string;
  type: "BUY" | "SELL";
  onClose: () => void;
  onConfirm: () => void;
};

export function TradeConfirmDialog({
  feeAmount,
  grossAmount,
  netAmount,
  onClose,
  onConfirm,
  price,
  quantity,
  submitting,
  symbol,
  type,
}: TradeConfirmDialogProps) {
  const isBuy = type === "BUY";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4">
      <div
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 text-[var(--color-text)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
            {isBuy ? "Xác nhận mua chứng khoán" : "Xác nhận bán chứng khoán"}
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

        <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--text-secondary)]">
          <DetailRow label="Mã chứng khoán" value={symbol} />
          <DetailRow label={isBuy ? "Giá mua" : "Giá bán"} value={formatStockMoney(price)} />
          <DetailRow label="Số lượng" value={`${quantity}`} />
          <DetailRow
            label={isBuy ? "Tiền mua chứng khoán" : "Tiền bán chứng khoán"}
            value={formatStockMoney(grossAmount)}
          />
          <DetailRow label="Phí giao dịch 0,2%" value={formatStockMoney(feeAmount)} />
          <DetailRow
            strong
            label={isBuy ? "Tổng tiền thanh toán" : "Tổng tiền nhận"}
            value={formatStockMoney(netAmount)}
          />
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button
            disabled={submitting}
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            No
          </Button>
          <Button disabled={submitting} type="button" onClick={onConfirm}>
            {submitting ? "Đang xử lý" : "Yes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border-card)] pb-2 last:border-0">
      <span>{label}</span>
      <span
        className={`max-w-[58%] break-words text-right ${
          strong
            ? "text-base font-bold text-[var(--text-primary)]"
            : "font-bold text-[var(--text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
