import { Download, FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getServerSession } from "@/lib/serverSession";

export default async function ReportsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ACCOUNT") {
    redirect("/dashboard");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[
        ["Monthly cashflow", "Excel export with deposits, repayments and fees"],
        ["Credit risk summary", "PDF report for active loans and overdue items"],
      ].map(([title, detail], index) => (
        <Card
          key={title}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <FileText size={19} />
            </div>
            <div>
              <p className="font-display font-bold text-[var(--text-primary)]">
                {title}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                {detail}
              </p>
            </div>
          </div>
          <Button variant={index === 0 ? "secondary" : "primary"}>
            <Download size={17} />
            {index === 0 ? "Excel" : "PDF"}
          </Button>
        </Card>
      ))}
    </div>
  );
}
