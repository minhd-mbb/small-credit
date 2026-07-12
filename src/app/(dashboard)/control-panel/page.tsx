import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreditCard,
  Landmark,
  Percent,
  PiggyBank,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getServerSession } from "@/lib/serverSession";

const roleLabels = {
  ADMIN: "Admin",
  BANK_ADMIN: "Bank admin",
  ACCOUNT: "Account",
};

const controlPanelItems = {
  ADMIN: [
    {
      href: "/control-panel/banks",
      title: "Quản trị Bank",
      description: "Add, edit and activate or deactivate banks.",
      icon: Landmark,
    },
    {
      href: "/accounts",
      title: "Users",
      description: "Create, edit, activate and reset accounts across banks.",
      icon: Users,
    },
    {
      href: "/control-panel/savings",
      title: "Quản trị tiết kiệm",
      description: "Configure basic, period and promotional saving interest rates.",
      icon: PiggyBank,
    },
    {
      href: "/control-panel/savings/base-rate",
      title: "Lãi suất cơ bản",
      description: "Set the system saving base rate and sync it to every bank.",
      icon: Percent,
    },
    {
      href: "/control-panel/loans/base-rate",
      title: "Lãi suất vay cơ bản",
      description: "Set the system loan base rate and sync it to every bank.",
      icon: Percent,
    },
    {
      href: "/control-panel/loans",
      title: "Quản trị vay",
      description: "Configure loan rates and create loan contracts.",
      icon: CreditCard,
    },
    {
      href: "/control-panel/funds",
      title: "Quỹ tiền",
      description: "Manage system and bank treasury funds.",
      icon: Landmark,
    },
  ],
  BANK_ADMIN: [
    {
      href: "/accounts",
      title: "Users",
      description: "Create, edit and disable accounts inside your bank.",
      icon: Users,
    },
    {
      href: "/control-panel/savings",
      title: "Quản trị tiết kiệm",
      description: "Configure saving interest rates for your bank.",
      icon: PiggyBank,
    },
    {
      href: "/control-panel/loans",
      title: "Quản trị vay",
      description: "Configure loan rates and create loan contracts.",
      icon: CreditCard,
    },
    {
      href: "/control-panel/funds",
      title: "Quỹ tiền",
      description: "Manage your bank treasury fund.",
      icon: Landmark,
    },
    {
      href: "/control-panel/stock-crawler",
      title: "Crawler chứng khoán",
      description: "Configure Playwright URL and raw JSON capture for stock price sync.",
      icon: TrendingUp,
    },
  ],
  ACCOUNT: [],
};

export default async function ControlPanelPage() {
  const session = await getServerSession();
  const role = session?.user.role ?? "ACCOUNT";

  if (role === "ACCOUNT") {
    redirect("/dashboard");
  }

  const items = controlPanelItems[role];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Quản trị
          </p>
          <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
            {session?.user.username}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
            {session?.user.bankName ?? "All banks"}
          </p>
        </div>
        <Badge tone={role === "ADMIN" ? "done" : "neutral"}>
          {roleLabels[role]}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title} className="min-h-44">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <Icon size={20} />
              </div>
              <h2 className="font-display mt-5 text-lg font-bold text-[var(--text-primary)]">
                {item.title}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-secondary)]">
                {item.description}
              </p>
              {"href" in item && item.href ? (
                <Link
                  className="mt-4 inline-flex text-sm font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
                  href={item.href}
                >
                  Open
                </Link>
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
