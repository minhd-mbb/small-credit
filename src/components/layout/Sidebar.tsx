"use client";

import {
  Banknote,
  ChevronDown,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  PiggyBank,
  Settings2,
  TrendingUp,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import supabase from "@/lib/supabaseClient";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { formatCompactVnd } from "@/lib/money-format";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/account", label: "Thông tin Tài khoản", icon: UserRound },
  {
    href: "/account/money-management",
    label: "Quản lý Tiền",
    icon: WalletCards,
    roles: ["ACCOUNT"],
  },
  { href: "/savings", label: "Tiết kiệm", icon: PiggyBank },
  { href: "/loans", label: "Vay", icon: HandCoins },
  {
    href: "/stock-investments",
    label: "Đầu tư chứng khoán",
    icon: TrendingUp,
    roles: ["ACCOUNT"],
  },
  { href: "/reports", label: "Báo cáo", icon: FileText },
];

const controlPanelItems = [
  {
    href: "/accounts",
    label: "Users",
    icon: WalletCards,
    roles: ["ADMIN", "BANK_ADMIN"],
  },
  {
    href: "/control-panel/deposits",
    label: "Nạp tiền tài khoản",
    icon: Upload,
    roles: ["ADMIN", "BANK_ADMIN"],
  },
  {
    href: "/control-panel/funds",
    label: "Quỹ tiền",
    icon: Landmark,
    roles: ["ADMIN", "BANK_ADMIN"],
  },
  {
    href: "/control-panel/stock-crawler",
    label: "Crawler chứng khoán",
    icon: TrendingUp,
    roles: ["BANK_ADMIN"],
  },
  {
    href: "/control-panel/loans/base-rate",
    label: "Lãi suất vay cơ bản",
    icon: Percent,
    roles: ["ADMIN"],
  },
  {
    href: "/control-panel/loans",
    label: "Quản trị vay",
    icon: HandCoins,
    roles: ["ADMIN", "BANK_ADMIN"],
  },
  {
    href: "/control-panel/savings/base-rate",
    label: "Lãi suất cơ bản",
    icon: Percent,
    roles: ["ADMIN"],
  },
  {
    href: "/control-panel/savings",
    label: "Quản trị tiết kiệm",
    icon: PiggyBank,
    roles: ["ADMIN", "BANK_ADMIN"],
  },
  {
    href: "/control-panel/banks",
    label: "Quản trị Bank",
    icon: Landmark,
    roles: ["ADMIN"],
  },
];

const menuItemBase =
  "group flex h-11 items-center rounded-lg text-[13px] font-bold leading-none transition-all duration-200 md:h-10";
const menuItemExpanded = "gap-3 px-3";
const menuItemCollapsed = "justify-center px-2";
const menuItemActive =
  "bg-[var(--color-charcoal)] text-white shadow-[0_10px_24px_rgba(26,26,46,0.16)]";
const menuItemIdle =
  "text-[var(--text-secondary)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)]";
const menuLabelClass = "hidden flex-1 text-left md:block";

type SidebarProps = {
  accountSummary: {
    balance: number | null;
    roleLabel: string | null;
  };
  collapsed: boolean;
  onToggleCollapsed: () => void;
  user: {
    role: "ADMIN" | "BANK_ADMIN" | "ACCOUNT";
    username: string;
    fullName: string;
    bankName: string | null;
  };
};

function isRouteActive(pathname: string, href: string) {
  if (href === "/control-panel") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isControlPanelItemActive(pathname: string, href: string) {
  if (href === "/accounts") {
    return pathname === "/accounts" || pathname.startsWith("/accounts/");
  }

  return pathname === href;
}

export function Sidebar({
  accountSummary,
  collapsed,
  onToggleCollapsed,
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const displayBankName = user.bankName ?? "All banks";
  const canUseControlPanel = user.role !== "ACCOUNT";
  const controlPanelActive =
    pathname === "/control-panel" ||
    pathname.startsWith("/control-panel/") ||
    pathname === "/accounts" ||
    pathname.startsWith("/accounts/");
  const [controlPanelOpen, setControlPanelOpen] = useState(controlPanelActive);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const isAdminRole = user.role === "ADMIN" || user.role === "BANK_ADMIN";

  async function handleLogout() {
    await supabase.auth.signOut();
    // router not available here; use location change
    window.location.href = "/login";
  }

  function toggleControlPanel() {
    if (collapsed) {
      onToggleCollapsed();
    }

    setControlPanelOpen((value) => !value);
  }

  return (
    <aside
      className={`fixed inset-x-0 bottom-0 z-30 flex h-16 flex-row items-center gap-2 overflow-x-auto border border-[var(--border-card)] bg-[var(--bg-sidebar)] px-3 shadow-[var(--shadow-card)] transition-[width] duration-300 md:sticky md:top-3 md:h-[calc(100vh-24px)] md:flex-col md:items-stretch md:overflow-visible md:rounded-[var(--radius-card)] md:p-3 ${
        collapsed ? "md:w-[76px]" : "md:w-64"
      }`}
    >
      <Link
        href="/account"
        aria-label="Mở màn hình tài khoản"
        title={collapsed ? "Thông tin Tài khoản" : undefined}
        className={`hidden items-center rounded-lg bg-[var(--primary-light)] py-3 transition-colors hover:bg-[#e2dcff] md:flex ${
          collapsed ? "justify-center px-2" : "gap-3 px-3"
        }`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
          <Banknote size={20} />
        </div>
        <div className={collapsed ? "hidden" : "block"}>
          <p className="text-[11px] font-bold uppercase text-[var(--text-muted)]">
            {displayBankName}
          </p>
          <p className="font-display mt-0.5 max-w-36 truncate text-sm font-bold text-[var(--text-primary)]">
            {user.fullName}
          </p>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            {user.username}
          </p>
        </div>
      </Link>

      <button
        className="hidden h-9 items-center justify-center rounded-lg border border-[var(--border-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)] md:flex"
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Open left panel" : "Close left panel"}
      >
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
      </button>

      <nav className="flex min-w-max flex-1 flex-row gap-1 md:min-w-0 md:flex-col md:pt-3">
        {mainNavItems
          .filter((item) => {
            if (item.href === "/reports") {
              return false;
            }

            if (item.href === "/dashboard" && user.role !== "ACCOUNT") {
              return false;
            }

            const accountOnlyItems = new Set([
              "/account/money-management",
              "/savings",
              "/loans",
              "/stock-investments",
              "/reports",
            ]);

            return user.role === "ACCOUNT" || !accountOnlyItems.has(item.href);
          })
          .map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/account"
                ? pathname === "/account" || pathname === "/account/logs"
                : isRouteActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`${menuItemBase} ${
                  collapsed ? menuItemCollapsed : menuItemExpanded
                } ${active ? menuItemActive : menuItemIdle}`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 ${
                    active ? "text-white" : ""
                  }`}
                />
                <span className={collapsed ? "hidden" : menuLabelClass}>
                  {item.label}
                </span>
              </Link>
            );
          })}

        {canUseControlPanel ? (
          <div className={collapsed ? "" : "md:space-y-1"}>
            <button
              className={`${menuItemBase} w-full ${
                collapsed ? menuItemCollapsed : menuItemExpanded
              } ${controlPanelActive ? menuItemActive : menuItemIdle}`}
              type="button"
              title={collapsed ? "Quản trị" : undefined}
              aria-expanded={controlPanelOpen}
              onClick={toggleControlPanel}
            >
              <Settings2
                size={18}
                className={`shrink-0 ${
                  controlPanelActive ? "text-white" : ""
                }`}
              />
              <span className={collapsed ? "hidden" : menuLabelClass}>
                Quản trị
              </span>
              <ChevronDown
                size={15}
                className={`hidden shrink-0 transition-transform md:block ${
                  controlPanelOpen ? "rotate-180" : ""
                } ${collapsed ? "md:hidden" : ""}`}
              />
            </button>

            {controlPanelOpen ? (
              <div className={collapsed ? "hidden" : "hidden md:block"}>
                {controlPanelItems
                  .filter((item) => item.roles.includes(user.role))
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isControlPanelItemActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`ml-5 flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-bold leading-none transition-all duration-200 ${
                          active
                            ? "bg-[var(--primary-light)] text-[var(--primary)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)]"
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>

      <button
        className={`${menuItemBase} min-w-11 text-white/58 hover:bg-white/10 hover:text-white ${
          collapsed ? menuItemCollapsed : menuItemExpanded
        }`}
        type="button"
        title={collapsed ? "Thoát" : undefined}
        onClick={() => setLogoutConfirmOpen(true)}
      >
        <LogOut size={18} className="shrink-0" />
        <span className={collapsed ? "hidden" : menuLabelClass}>Thoát</span>
      </button>

      <div
        className={`relative mt-auto hidden overflow-hidden rounded-lg bg-[var(--color-charcoal)] p-4 text-white md:block ${
          collapsed ? "md:hidden" : ""
        }`}
      >
        <div className="absolute -right-8 -top-10 h-28 w-28 rotate-12 border border-white/20" />
        {!isAdminRole ? (
          <p className="relative text-xs font-semibold text-white/60">
            Số dư tài khoản
          </p>
        ) : null}
        <p className="relative mt-2 font-display text-2xl font-bold">
          {accountSummary.balance === null
            ? accountSummary.roleLabel ?? user.role
            : formatCompactVnd(accountSummary.balance)}
        </p>
        {!isAdminRole ? (
          <p className="relative mt-1 text-xs leading-5 text-white/70">
            Tài khoản đang đăng nhập
          </p>
        ) : null}
      </div>

      {logoutConfirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-white p-5 text-[var(--color-text)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
          >
            <h2
              id="logout-confirm-title"
              className="font-display text-lg font-bold text-[var(--color-text)]"
            >
              Bạn muốn thoát ứng dụng?
            </h2>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="h-10 rounded-xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-bg)]"
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                No
              </button>
              <button
                className="h-10 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--primary-dark)]"
                type="button"
                onClick={handleLogout}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
