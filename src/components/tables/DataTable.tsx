import { Badge } from "@/components/ui/Badge";

type TableStatus = "Done" | "In progress" | "To do" | "Active" | "Pending";

type DataRow = {
  name: string;
  owner: string;
  members: number;
  status: TableStatus;
  amount: string;
  date: string;
};

type DataTableProps = {
  rows: DataRow[];
};

function getTone(status: TableStatus) {
  if (status === "Done" || status === "Active") {
    return "done";
  }

  if (status === "In progress") {
    return "progress";
  }

  return "todo";
}

export function DataTable({ rows }: DataTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <p className="font-display text-base font-bold text-[var(--color-text)]">
          No records yet
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--color-text-muted)]">
          New accounts, loans and reports will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white shadow-[var(--shadow-card)]">
      <table className="w-full table-auto border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="w-10 px-4 py-3">
              <span className="block h-[18px] w-[18px] rounded-md border-2 border-gray-300" />
            </th>
            {["Name", "Owner", "Members", "Status", "Amount", "Date"].map(
              (column) => (
                <th
                  key={column}
                  className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  {column}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.name}
              className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--primary-light)]/70"
            >
              <td className="align-top px-3 py-3">
                <span
                  className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 text-[10px] font-extrabold ${
                    index === 0
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {index === 0 ? "✓" : ""}
                </span>
              </td>
              <td className="break-words px-3 py-3 align-top font-bold text-[var(--text-primary)]">
                {row.name}
              </td>
              <td className="px-3 py-3 align-top">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-charcoal)] text-[10px] font-bold text-white">
                    {row.owner
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <span className="break-words font-semibold text-[var(--text-primary)]">
                    {row.owner}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 align-top text-[var(--text-secondary)]">
                {row.members}
              </td>
              <td className="px-3 py-3 align-top">
                <Badge tone={getTone(row.status)}>{row.status}</Badge>
              </td>
              <td className="break-words px-3 py-3 align-top font-semibold text-[var(--text-primary)]">
                {row.amount}
              </td>
              <td className="px-3 py-3 align-top">
                <span className="inline-flex max-w-full rounded-md bg-[var(--primary-light)] px-2 py-1 text-xs font-bold text-[var(--primary)]">
                  {row.date}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
