"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  calculateStockTradePreview,
  formatStockMoney,
  toStockUnitPriceVnd,
} from "@/components/stocks/stock-format";
import { StockQuantityInput } from "@/components/stocks/StockQuantityInput";
import {
  StockSymbolSelect,
  type TradableStockOption,
} from "@/components/stocks/StockSymbolSelect";
import { TradeConfirmDialog } from "@/components/stocks/TradeConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type StockItem = {
  id: string;
  symbol: string;
  companyName: string | null;
  price: number | null;
  changePercent: number | null;
  syncedAt: string | null;
};

type StockHolding = {
  id: string;
  symbol: string;
  quantity: number;
  averageCostPrice: number;
  totalCost: number;
  currentPrice: number | null;
  changePercent: number | null;
};

type StockTrade = {
  id: string;
  type: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  createdAt: string;
};

type StockInvestmentsClientProps = {
  accountBalance: number;
  holdings: StockHolding[];
  initialItems: StockItem[];
  trades: StockTrade[];
};

type ConfirmTrade = {
  type: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function StockInvestmentsClient({
  accountBalance,
  holdings,
  initialItems,
  trades,
}: StockInvestmentsClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [symbol, setSymbol] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingSymbol, setEditingSymbol] = useState("");
  const [buySymbol, setBuySymbol] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("");
  const [sellSymbol, setSellSymbol] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");
  const [confirmTrade, setConfirmTrade] = useState<ConfirmTrade | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tradableStocks = useMemo<TradableStockOption[]>(
    () =>
      items
        .filter((item): item is StockItem & { price: number } => item.price !== null)
        .map((item) => ({
          symbol: item.symbol,
          price: item.price,
          changePercent: item.changePercent,
          companyName: item.companyName,
        })),
    [items],
  );
  const buyStock = tradableStocks.find((item) => item.symbol === buySymbol);
  const sellableStocks = holdings
    .filter((holding) => holding.currentPrice !== null && holding.quantity > 0)
    .map((holding) => ({
      symbol: holding.symbol,
      price: holding.currentPrice ?? 0,
      changePercent: holding.changePercent,
      companyName: null,
    }));
  const sellHolding = holdings.find((holding) => holding.symbol === sellSymbol);
  const sellStock = sellableStocks.find((item) => item.symbol === sellSymbol);

  async function reloadItems() {
    const response = await fetch("/api/stocks/watchlist");
    const payload = await response.json();

    if (response.ok) {
      setItems(payload.data ?? []);
    }
  }

  async function addSymbol() {
    const nextSymbol = normalizeSymbol(symbol);
    setError("");
    setMessage("");

    if (!nextSymbol) {
      setError("Nhập mã chứng khoán cần theo dõi.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/stocks/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: nextSymbol }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Không thể thêm mã chứng khoán.");
      return;
    }

    setSymbol("");
    setMessage("Đã thêm mã chứng khoán.");
    await reloadItems();
    router.refresh();
  }

  function startEdit(item: StockItem) {
    setError("");
    setMessage("");
    setEditingId(item.id);
    setEditingSymbol(item.symbol);
  }

  async function saveEdit(itemId: string) {
    const nextSymbol = normalizeSymbol(editingSymbol);
    setError("");
    setMessage("");

    if (!nextSymbol) {
      setError("Mã chứng khoán không hợp lệ.");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/stocks/watchlist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: nextSymbol }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Không thể sửa mã chứng khoán.");
      return;
    }

    setEditingId("");
    setEditingSymbol("");
    setMessage("Đã cập nhật mã chứng khoán.");
    await reloadItems();
    router.refresh();
  }

  async function deleteSymbol(itemId: string) {
    setError("");
    setMessage("");
    setSubmitting(true);
    const response = await fetch(`/api/stocks/watchlist/${itemId}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Không thể xóa mã chứng khoán.");
      return;
    }

    setMessage("Đã xóa mã chứng khoán.");
    await reloadItems();
    router.refresh();
  }

  function validateTrade(type: "BUY" | "SELL") {
    setError("");
    setMessage("");

    const selectedSymbol = type === "BUY" ? buySymbol : sellSymbol;
    const selectedQuantity = Number(type === "BUY" ? buyQuantity : sellQuantity);
    const selectedStock = type === "BUY" ? buyStock : sellStock;

    if (!selectedSymbol || !selectedStock) {
      setError(
        type === "BUY"
          ? "Chọn mã chứng khoán đã có giá đồng bộ."
          : "Chọn mã chứng khoán đang nắm giữ và đã có giá đồng bộ.",
      );
      return;
    }

    if (
      !Number.isFinite(selectedQuantity) ||
      selectedQuantity <= 0 ||
      selectedQuantity % 100 !== 0
    ) {
      setError("Số lượng chứng khoán phải là bội số của 100.");
      return;
    }

    if (type === "SELL" && sellHolding && selectedQuantity > sellHolding.quantity) {
      setError("Không đủ số lượng chứng khoán để bán.");
      return;
    }

    const preview = calculateStockTradePreview({
      price: selectedStock.price,
      quantity: selectedQuantity,
      type,
    });

    if (type === "BUY" && preview.netAmount > accountBalance) {
      setError("Không đủ số dư tài khoản");
      return;
    }

    setConfirmTrade({
      type,
      symbol: selectedSymbol,
      quantity: selectedQuantity,
      price: preview.unitPrice,
    });
  }

  async function submitTrade() {
    if (!confirmTrade) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/stocks/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: confirmTrade.quantity,
        symbol: confirmTrade.symbol,
        type: confirmTrade.type,
      }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Không thể hoàn tất giao dịch chứng khoán.");
      setConfirmTrade(null);
      return;
    }

    setMessage(
      confirmTrade.type === "BUY"
        ? "Đã mua chứng khoán."
        : "Đã bán chứng khoán.",
    );
    setBuyQuantity("");
    setSellQuantity("");
    setConfirmTrade(null);
    router.refresh();
  }

  const confirmPreview = confirmTrade
    ? calculateStockTradePreview({
        price: confirmTrade.price,
        quantity: confirmTrade.quantity,
        type: confirmTrade.type,
      })
    : null;

  return (
    <section className="min-w-0 space-y-5">
      <HoldingsCard holdings={holdings} />

      <div className="xl:w-[45%]">
        <WatchlistCard
          editingId={editingId}
          editingSymbol={editingSymbol}
          items={items}
          setEditingSymbol={setEditingSymbol}
          setSymbol={setSymbol}
          submitting={submitting}
          symbol={symbol}
          onAdd={addSymbol}
          onDelete={deleteSymbol}
          onSaveEdit={saveEdit}
          onStartEdit={startEdit}
        />
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--status-done)] px-3 py-2 text-sm font-bold text-[var(--status-done-text)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <BuyCard
          accountBalance={accountBalance}
          buyQuantity={buyQuantity}
          buyStock={buyStock}
          buySymbol={buySymbol}
          setBuyQuantity={setBuyQuantity}
          setBuySymbol={setBuySymbol}
          submitting={submitting}
          tradableStocks={tradableStocks}
          onBuy={() => validateTrade("BUY")}
        />
        <SellCard
          sellHolding={sellHolding}
          sellQuantity={sellQuantity}
          sellStock={sellStock}
          sellSymbol={sellSymbol}
          sellableStocks={sellableStocks}
          setSellQuantity={setSellQuantity}
          setSellSymbol={setSellSymbol}
          submitting={submitting}
          onSell={() => validateTrade("SELL")}
        />
      </div>

      <TradeHistoryCard trades={trades} />

      {confirmTrade && confirmPreview ? (
        <TradeConfirmDialog
          feeAmount={confirmPreview.feeAmount}
          grossAmount={confirmPreview.grossAmount}
          netAmount={confirmPreview.netAmount}
          price={confirmPreview.unitPrice}
          quantity={confirmTrade.quantity}
          submitting={submitting}
          symbol={confirmTrade.symbol}
          type={confirmTrade.type}
          onClose={() => setConfirmTrade(null)}
          onConfirm={submitTrade}
        />
      ) : null}
    </section>
  );
}

function HoldingsCard({ holdings }: { holdings: StockHolding[] }) {
  return (
    <Card className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Danh mục chứng khoán
          </p>
          <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
            {holdings.length} mã đang nắm giữ
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-card)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
              {["Mã", "Số lượng", "Giá vốn", "Giá hiện tại", "Giá trị", "Lãi/Lỗ"].map(
                (column) => (
                  <th
                    key={column}
                    className="px-3 py-3 text-xs font-bold uppercase text-[var(--text-muted)]"
                  >
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-sm font-semibold text-[var(--text-secondary)]"
                  colSpan={6}
                >
                  Chưa có chứng khoán đã mua.
                </td>
              </tr>
            ) : (
              holdings.map((holding) => {
                const currentUnitPrice =
                  holding.currentPrice === null
                    ? null
                    : toStockUnitPriceVnd(holding.currentPrice);
                const currentValue =
                  currentUnitPrice === null
                    ? null
                    : currentUnitPrice * holding.quantity;
                const profitLoss =
                  currentValue === null ? null : currentValue - holding.totalCost;
                const profitTone =
                  profitLoss === null
                    ? "text-[var(--text-secondary)]"
                    : profitLoss >= 0
                      ? "text-[var(--status-done-text)]"
                      : "text-red-700";

                return (
                  <tr
                    key={holding.id}
                    className="border-b border-[var(--border-card)] last:border-0"
                  >
                    <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                      {holding.symbol}
                    </td>
                    <td className="px-3 py-3 font-semibold">{holding.quantity}</td>
                    <td className="px-3 py-3 font-semibold">
                      {formatStockMoney(holding.averageCostPrice)}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {currentUnitPrice === null
                        ? "-"
                        : formatStockMoney(currentUnitPrice)}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {currentValue === null ? "-" : formatStockMoney(currentValue)}
                    </td>
                    <td className={`px-3 py-3 font-bold ${profitTone}`}>
                      {profitLoss === null ? "-" : formatStockMoney(profitLoss)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function WatchlistCard({
  editingId,
  editingSymbol,
  items,
  onAdd,
  onDelete,
  onSaveEdit,
  onStartEdit,
  setEditingSymbol,
  setSymbol,
  submitting,
  symbol,
}: {
  editingId: string;
  editingSymbol: string;
  items: StockItem[];
  onAdd: () => void;
  onDelete: (itemId: string) => void;
  onSaveEdit: (itemId: string) => void;
  onStartEdit: (item: StockItem) => void;
  setEditingSymbol: (value: string) => void;
  setSymbol: (value: string) => void;
  submitting: boolean;
  symbol: string;
}) {
  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Danh sách theo dõi
          </p>
          <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
            {items.length}/10 mã
          </h2>
        </div>
        <Badge tone={items.length >= 10 ? "todo" : "progress"}>Tối đa 10</Badge>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold uppercase text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          disabled={items.length >= 10 || submitting}
          maxLength={10}
          placeholder="VD: TCB"
          value={symbol}
          onChange={(event) => setSymbol(normalizeSymbol(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void onAdd();
            }
          }}
        />
        <Button disabled={items.length >= 10 || submitting} type="button" onClick={onAdd}>
          <Plus size={17} />
          Thêm
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-[var(--border-card)] px-3 py-4 text-sm font-semibold text-[var(--text-secondary)]">
            Chưa có mã chứng khoán.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-card)] px-3 py-2"
            >
              {editingId === item.id ? (
                <input
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-card)] px-3 text-sm font-bold uppercase outline-none focus:border-[var(--primary)]"
                  maxLength={10}
                  value={editingSymbol}
                  onChange={(event) =>
                    setEditingSymbol(normalizeSymbol(event.target.value))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void onSaveEdit(item.id);
                    }
                  }}
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-[var(--text-primary)]">
                    {item.symbol}
                  </p>
                  <p className="truncate text-xs font-semibold text-[var(--text-secondary)]">
                    {item.price === null
                      ? "Chưa có giá đồng bộ"
                      : formatStockMoney(toStockUnitPriceVnd(item.price))}
                  </p>
                </div>
              )}

              {editingId === item.id ? (
                <Button
                  disabled={submitting}
                  type="button"
                  onClick={() => onSaveEdit(item.id)}
                >
                  Lưu
                </Button>
              ) : (
                <Button
                  aria-label={`Sửa ${item.symbol}`}
                  disabled={submitting}
                  size="icon"
                  type="button"
                  variant="secondary"
                  onClick={() => onStartEdit(item)}
                >
                  <Pencil size={16} />
                </Button>
              )}
              <Button
                aria-label={`Xóa ${item.symbol}`}
                disabled={submitting}
                size="icon"
                type="button"
                variant="secondary"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function BuyCard({
  accountBalance,
  buyQuantity,
  buyStock,
  buySymbol,
  onBuy,
  setBuyQuantity,
  setBuySymbol,
  submitting,
  tradableStocks,
}: {
  accountBalance: number;
  buyQuantity: string;
  buyStock?: TradableStockOption;
  buySymbol: string;
  onBuy: () => void;
  setBuyQuantity: (value: string) => void;
  setBuySymbol: (value: string) => void;
  submitting: boolean;
  tradableStocks: TradableStockOption[];
}) {
  return (
    <Card className="min-w-0">
      <div>
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Mua chứng khoán
        </p>
        <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
          Số dư {formatStockMoney(accountBalance)}
        </h2>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <StockSymbolSelect
          options={tradableStocks}
          value={buySymbol}
          onChange={setBuySymbol}
        />
        <StockQuantityInput value={buyQuantity} onChange={setBuyQuantity} />
      </div>
      <TradePreview price={buyStock?.price ?? null} quantity={Number(buyQuantity)} type="BUY" />
      <div className="mt-4 flex justify-end">
        <Button
          disabled={submitting || tradableStocks.length === 0}
          type="button"
          onClick={onBuy}
        >
          Mua
        </Button>
      </div>
    </Card>
  );
}

function SellCard({
  onSell,
  sellHolding,
  sellQuantity,
  sellStock,
  sellSymbol,
  sellableStocks,
  setSellQuantity,
  setSellSymbol,
  submitting,
}: {
  onSell: () => void;
  sellHolding?: StockHolding;
  sellQuantity: string;
  sellStock?: TradableStockOption;
  sellSymbol: string;
  sellableStocks: TradableStockOption[];
  setSellQuantity: (value: string) => void;
  setSellSymbol: (value: string) => void;
  submitting: boolean;
}) {
  return (
    <Card className="min-w-0">
      <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
        Bán chứng khoán
      </p>
      <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
        Theo số lượng tùy chọn
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <StockSymbolSelect
          options={sellableStocks}
          value={sellSymbol}
          onChange={setSellSymbol}
        />
        <StockQuantityInput
          max={sellHolding?.quantity}
          value={sellQuantity}
          onChange={setSellQuantity}
        />
      </div>
      {sellHolding ? (
        <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">
          Đang giữ {sellHolding.quantity} cổ phiếu {sellHolding.symbol}.
        </p>
      ) : null}
      <TradePreview price={sellStock?.price ?? null} quantity={Number(sellQuantity)} type="SELL" />
      <div className="mt-4 flex justify-end">
        <Button
          disabled={submitting || sellableStocks.length === 0}
          type="button"
          onClick={onSell}
        >
          Bán
        </Button>
      </div>
    </Card>
  );
}

function TradeHistoryCard({ trades }: { trades: StockTrade[] }) {
  return (
    <Card className="min-w-0">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
          Lịch sử giao dịch chứng khoán
        </p>
        <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
          50 giao dịch mới nhất
        </h2>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-card)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
              {["Thời gian", "Loại", "Mã", "Số lượng", "Giá", "Phí", "Tổng"].map(
                (column) => (
                  <th
                    key={column}
                    className="px-3 py-3 text-xs font-bold uppercase text-[var(--text-muted)]"
                  >
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-sm font-semibold text-[var(--text-secondary)]"
                  colSpan={7}
                >
                  Chưa có giao dịch chứng khoán.
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-[var(--border-card)] last:border-0"
                >
                  <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                    {dateTimeFormatter.format(new Date(trade.createdAt))}
                  </td>
                  <td className="px-3 py-3 font-bold">
                    {trade.type === "BUY" ? "Mua" : "Bán"}
                  </td>
                  <td className="px-3 py-3 font-bold">{trade.symbol}</td>
                  <td className="px-3 py-3 font-semibold">{trade.quantity}</td>
                  <td className="px-3 py-3 font-semibold">
                    {formatStockMoney(trade.price)}
                  </td>
                  <td className="px-3 py-3 font-semibold">
                    {formatStockMoney(trade.feeAmount)}
                  </td>
                  <td className="px-3 py-3 font-bold">
                    {formatStockMoney(trade.netAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TradePreview({
  price,
  quantity,
  type,
}: {
  price: number | null;
  quantity: number;
  type: "BUY" | "SELL";
}) {
  if (!price || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const preview = calculateStockTradePreview({ price, quantity, type });

  return (
    <div className="mt-4 rounded-xl bg-[var(--primary-light)] px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]">
      <div className="grid gap-2 md:grid-cols-3">
        <span>
          Giá:{" "}
          <strong className="text-[var(--text-primary)]">
            {formatStockMoney(preview.unitPrice)}
          </strong>
        </span>
        <span>
          Phí:{" "}
          <strong className="text-[var(--text-primary)]">
            {formatStockMoney(preview.feeAmount)}
          </strong>
        </span>
        <span>
          {type === "BUY" ? "Tổng trả" : "Tổng nhận"}:{" "}
          <strong className="text-[var(--text-primary)]">
            {formatStockMoney(preview.netAmount)}
          </strong>
        </span>
      </div>
    </div>
  );
}
