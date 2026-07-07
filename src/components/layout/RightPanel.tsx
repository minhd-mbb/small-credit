"use client";

import { Landmark, PiggyBank, RefreshCw, TrendingUp, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCompactVnd } from "@/lib/money-format";

type RightPanelProps = {
  data: {
    assetSummary: {
      accountBalance: number;
      totalSavings: number;
      totalLoans: number;
    };
    balanceSeries: { label: string; value: number }[];
    latestCashMovement: {
      amount: number;
      direction: "IN" | "OUT";
    } | null;
    savings: {
      id: string;
      principal: number;
      accruedInterest: number;
    }[];
    stockPrices: {
      id: string;
      symbol: string;
      price: number | null;
      changePercent: number | null;
      syncedAt: string | null;
    }[];
    topAccounts: {
      accountNo: string;
      fullName: string;
      balance: number;
    }[];
  };
  userRole: "ADMIN" | "BANK_ADMIN" | "ACCOUNT";
};

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});
const priceFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 3,
});
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatStockPrice(price: number | null) {
  if (price === null) {
    return "-";
  }

  return price < 1000
    ? `${priceFormatter.format(price)}K`
    : priceFormatter.format(price);
}

function formatStockChange(changePercent: number | null) {
  if (changePercent === null) {
    return "-";
  }

  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(changePercent)}%`;
}

export function RightPanel({ data, userRole }: RightPanelProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [stockMessage, setStockMessage] = useState("");
  const [stockError, setStockError] = useState("");
  const maxTopBalance = Math.max(...data.topAccounts.map((item) => item.balance), 1);
  const totalAssets =
    data.assetSummary.accountBalance -
    data.assetSummary.totalLoans +
    data.assetSummary.totalSavings;
  const latestStockSync = data.stockPrices
    .map((item) => item.syncedAt)
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0];

  async function syncStockPrices() {
    setStockMessage("");
    setStockError("");
    setSyncing(true);
    const response = await fetch("/api/stocks/sync", { method: "POST" });
    const payload = await response.json();
    setSyncing(false);

    if (!response.ok) {
      setStockError(payload.error ?? "Không thể đồng bộ giá chứng khoán.");
      return;
    }

    setStockMessage("Đã đồng bộ giá.");
    router.refresh();
  }

  return (
    <aside className="flex w-full min-w-0 flex-col gap-4 md:col-start-2 xl:col-start-auto xl:min-h-[calc(100vh-32px)] xl:w-80">
      {userRole === "ACCOUNT" ? (
        <>
          <Card dark className="relative overflow-hidden p-5">
            <div className="absolute -right-8 top-8 h-28 w-28 rotate-12 border border-white/10" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/45">Tổng tài sản</p>
                <p
                  className={`font-display mt-3 break-words text-3xl font-bold ${
                    totalAssets < 0 ? "text-[var(--color-accent)]" : "text-white"
                  }`}
                >
                  {formatCompactVnd(totalAssets)}
                </p>
              </div>
              <Landmark size={22} className="shrink-0 text-white/65" />
            </div>
            <div className="relative mt-6 space-y-3 text-sm font-semibold">
              <div className="flex items-center justify-between gap-3 text-white/75">
                <span>Số dư tài khoản</span>
                <span className="text-right text-white">
                  {formatCompactVnd(data.assetSummary.accountBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-white/75">
                <span>Tổng tiết kiệm</span>
                <span className="text-right text-white">
                  {formatCompactVnd(data.assetSummary.totalSavings)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-white/75">
                <span>Tổng vay</span>
                <span className="text-right text-white">
                  {formatCompactVnd(data.assetSummary.totalLoans)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="bg-[var(--color-cream)]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[var(--color-text)]">
                Tiết kiệm gần nhất
              </h2>
              <PiggyBank size={19} className="text-[var(--color-primary)]" />
            </div>
            <div className="mt-4 space-y-3">
              {data.savings.length === 0 ? (
                <p className="rounded-2xl border border-black/5 bg-white px-3 py-3 text-sm font-semibold text-[var(--color-text-muted)]">
                  Chưa có khoản tiết kiệm.
                </p>
              ) : (
                data.savings.map((saving) => (
                  <Link
                    key={saving.id}
                    className="block rounded-2xl border border-black/5 bg-white px-3 py-3 transition-colors hover:bg-[var(--color-primary-bg)]"
                    href="/savings"
                  >
                    <p className="text-sm font-bold text-[var(--color-text)]">
                      {formatCompactVnd(saving.principal)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">
                      Lãi tới hôm nay: {formatCompactVnd(saving.accruedInterest)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-[var(--color-text)]">
                Bảng giá chứng khoán
              </h2>
              <TrendingUp size={19} className="shrink-0 text-[var(--color-primary)]" />
            </div>

            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-[64px_minmax(0,1fr)_76px] gap-2 text-[11px] font-bold uppercase text-[var(--text-muted)]">
                <span>Mã</span>
                <span className="text-right">Giá</span>
                <span className="text-right">%</span>
              </div>
              {data.stockPrices.length === 0 ? (
                <p className="rounded-xl border border-[var(--border-card)] px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                  Chưa có mã theo dõi.
                </p>
              ) : (
                data.stockPrices.slice(0, 10).map((item) => {
                  const changeTone =
                    item.changePercent === null
                      ? "text-[var(--text-secondary)]"
                      : item.changePercent >= 0
                        ? "text-[var(--status-done-text)]"
                        : "text-red-700";

                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[64px_minmax(0,1fr)_76px] items-center gap-2 rounded-xl border border-[var(--border-card)] px-2.5 py-2 text-sm"
                    >
                      <span className="truncate font-bold text-[var(--text-primary)]">
                        {item.symbol}
                      </span>
                      <span className="truncate text-right font-bold text-[var(--text-primary)]">
                        {formatStockPrice(item.price)}
                      </span>
                      <span className={`truncate text-right font-bold ${changeTone}`}>
                        {formatStockChange(item.changePercent)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs font-semibold text-[var(--text-secondary)]">
                {latestStockSync
                  ? `Cập nhật: ${dateTimeFormatter.format(new Date(latestStockSync))}`
                  : "Chưa đồng bộ"}
              </p>
              <Button
                disabled={syncing || data.stockPrices.length === 0}
                size="icon"
                type="button"
                variant="secondary"
                onClick={syncStockPrices}
              >
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              </Button>
            </div>
            {stockMessage ? (
              <p className="mt-2 text-xs font-bold text-[var(--status-done-text)]">
                {stockMessage}
              </p>
            ) : null}
            {stockError ? (
              <p className="mt-2 text-xs font-bold text-red-700">{stockError}</p>
            ) : null}
          </Card>
        </>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-[var(--color-text)]">
            Top số dư tài khoản
          </h2>
          <WalletCards size={19} className="text-[var(--color-primary)]" />
        </div>
        <div className="mt-5 space-y-4">
          {data.topAccounts.length === 0 ? (
            <p className="text-sm font-semibold text-[var(--color-text-muted)]">
              Chưa có tài khoản active.
            </p>
          ) : (
            data.topAccounts.map((account) => {
              const width = (account.balance / maxTopBalance) * 100;

              return (
                <div key={account.accountNo}>
                  <div className="mb-2 flex items-start justify-between gap-3 text-sm font-bold">
                    <span className="min-w-0">
                      <span className="block truncate">{account.accountNo}</span>
                      <span className="block truncate text-xs text-[var(--text-secondary)]">
                        {account.fullName}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {formatCompactVnd(account.balance)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{ width: `${Math.max(width, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </aside>
  );
}
