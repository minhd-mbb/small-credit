import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getServerSession } from "@/lib/serverSession";

type LoanDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LoanDetailPage({ params }: LoanDetailPageProps) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ACCOUNT") {
    redirect("/dashboard");
  }

  const { id } = await params;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
          Loan detail
        </h1>
        <p className="text-sm font-medium text-[var(--text-secondary)]">{id}</p>
      </div>
      <Card>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Lịch trả nợ sẽ dùng `generateLoanSchedule` trong `src/lib/calculations.ts`.
        </p>
      </Card>
    </div>
  );
}
