import { redirect } from "next/navigation";
import { AccountLogsTable } from "@/app/(dashboard)/account/logs/AccountLogsTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActivityLogRecord = {
  id: string;
  action: string;
  time: Date;
  functionName: string;
  beforeChange: unknown;
  afterChange: unknown;
};

export default async function AccountLogsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const logs = await prisma.activityLog.findMany({
    where: { username: session.user.username },
    orderBy: { time: "desc" },
    take: 15,
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white p-5 shadow-[var(--shadow-card)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Tài khoản
          </p>
          <h1 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
            Lịch sử giao dịch
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
            Chỉ hiển thị 15 dòng mới nhất của tài khoản đang đăng nhập.
          </p>
        </div>
        <Badge tone="neutral">{logs.length} records</Badge>
      </div>

      {logs.length === 0 ? (
        <Card>
          <p className="font-display text-base font-bold text-[var(--text-primary)]">
            No activity logs yet
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
            Data-changing actions will appear here automatically.
          </p>
        </Card>
      ) : (
        <AccountLogsTable
          logs={logs.map((log: ActivityLogRecord) => ({
            id: log.id,
            action: log.action,
            time: log.time.toLocaleString("vi-VN"),
            functionName: log.functionName,
            beforeChange: log.beforeChange,
            afterChange: log.afterChange,
          }))}
        />
      )}
    </section>
  );
}
