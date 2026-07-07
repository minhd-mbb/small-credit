import { Card } from "@/components/ui/Card";

type AccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
          Account detail
        </h1>
        <p className="text-sm font-medium text-[var(--text-secondary)]">{id}</p>
      </div>
      <Card>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Transaction history and balance data will be loaded from the account
          API.
        </p>
      </Card>
    </div>
  );
}
