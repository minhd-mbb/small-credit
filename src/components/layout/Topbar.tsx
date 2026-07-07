"use client";

import { CalendarDays, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/layout/NotificationBell";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "06 Jun 2026 / weekly operating view",
  },
  "/account/logs": {
    title: "Lịch sử giao dịch",
    subtitle: "Account activity logs and data-change history",
  },
  "/account/money-management": {
    title: "Quản lý Tiền",
    subtitle: "Dòng tiền và số dư tài khoản",
  },
  "/account": {
    title: "Tài khoản",
    subtitle: "Thông tin tài khoản đang đăng nhập",
  },
  "/accounts": {
    title: "Users",
    subtitle: "User accounts, access and account health",
  },
  "/control-panel/deposits": {
    title: "Nạp tiền",
    subtitle: "Deposit funds into active accounts",
  },
  "/control-panel/funds": {
    title: "Quỹ tiền",
    subtitle: "Fund treasury management",
  },
  "/control-panel/stock-crawler": {
    title: "Crawler chứng khoán",
    subtitle: "Playwright URL and raw JSON capture settings",
  },
  "/control-panel/loans/base-rate": {
    title: "Lãi suất vay cơ bản",
    subtitle: "System loan base rate",
  },
  "/control-panel/loans": {
    title: "Quản trị vay",
    subtitle: "Loan rate policies and contracts",
  },
  "/control-panel/savings/base-rate": {
    title: "Lãi suất cơ bản",
    subtitle: "System saving base rate",
  },
  "/control-panel/savings": {
    title: "Quản trị tiết kiệm",
    subtitle: "Savings interest policies",
  },
  "/control-panel/banks": {
    title: "Quản trị Bank",
    subtitle: "Bank setup and active status",
  },
  "/control-panel": {
    title: "Quản trị",
    subtitle: "Administration tools and policy controls",
  },
  "/savings": {
    title: "Tiết kiệm",
    subtitle: "Terms, maturity dates and interest yield",
  },
  "/loans": {
    title: "Vay",
    subtitle: "Disbursement, repayment and overdue risk",
  },
  "/stock-investments": {
    title: "Đầu tư chứng khoán",
    subtitle: "Watchlist and cached crawler prices",
  },
  "/reports": {
    title: "Báo cáo",
    subtitle: "Cashflow and credit summaries",
  },
};

function getTitle(pathname: string) {
  const key = Object.keys(titles)
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`));

  return key ? titles[key] : titles["/dashboard"];
}

type TopbarProps = {
  bankCode: string | null;
  bankName: string | null;
};

export function Topbar({ bankCode, bankName }: TopbarProps) {
  const pathname = usePathname();
  const page = getTitle(pathname);
  const displayBankName = bankName ?? "All banks";
  const displayBankCode = (bankCode ?? "ALL").slice(0, 4).toUpperCase();

  return (
    <header className="relative mb-6 overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="absolute right-0 top-0 hidden h-full w-80 skew-x-[-14deg] bg-[var(--color-primary-bg)] lg:block" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary-lt)]">
            <CalendarDays size={14} />
            <span>{page.subtitle}</span>
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold leading-tight text-[var(--color-text)] md:text-3xl">
            {page.title}
          </h1>
          <div className="mt-4 h-1.5 w-28 rounded-full bg-[var(--color-primary)]" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 min-w-56 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 transition-all focus-within:border-[var(--color-primary-lt)] focus-within:shadow-[0_0_0_3px_rgba(26,92,46,0.12)]">
            <Search size={16} className="text-[var(--text-muted)]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder="Search records..."
            />
          </div>
          <NotificationBell />
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-bold text-white">
              {displayBankCode}
            </div>
            <span className="hidden text-sm font-bold text-[var(--color-text)] sm:block">
              {displayBankName}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
