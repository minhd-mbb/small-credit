"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { FloatingCommandMenu } from "@/components/layout/FloatingCommandMenu";
import { RightPanel } from "@/components/layout/RightPanel";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type AppShellProps = {
  accountSummary: {
    balance: number | null;
    roleLabel: string | null;
  };
  children: ReactNode;
  rightPanel: {
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
  user: {
    role: "ADMIN" | "BANK_ADMIN" | "ACCOUNT";
    username: string;
    fullName: string;
    bankName: string | null;
    bankCode: string | null;
  };
};

export function AppShell({
  accountSummary,
  children,
  rightPanel,
  user,
}: AppShellProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      className={`grid min-h-screen grid-cols-1 gap-3 p-3 pb-20 transition-[grid-template-columns] duration-300 md:pb-3 ${
        panelOpen
          ? sidebarOpen
            ? "md:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)_320px]"
            : "md:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[76px_minmax(0,1fr)_320px]"
          : sidebarOpen
            ? "md:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)]"
            : "md:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[76px_minmax(0,1fr)]"
      }`}
    >
      <Sidebar
        accountSummary={accountSummary}
        collapsed={!sidebarOpen}
        onToggleCollapsed={() => setSidebarOpen((value) => !value)}
        user={user}
      />
      <div className="min-w-0">
        <Topbar bankCode={user.bankCode} bankName={user.bankName} />
        <main className="w-full min-w-0">{children}</main>
      </div>
      {panelOpen ? <RightPanel data={rightPanel} userRole={user.role} /> : null}
      <FloatingCommandMenu
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((value) => !value)}
      />
    </div>
  );
}
