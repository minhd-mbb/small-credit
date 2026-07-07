"use client";

import { useState } from "react";
import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type ActivityLogRow = {
  id: string;
  action: string;
  time: string;
  functionName: string;
  beforeChange: unknown;
  afterChange: unknown;
};

type AccountLogsTableProps = {
  logs: ActivityLogRow[];
};

function formatChange(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function ChangeBlock({ label, value }: { label: string; value: unknown }) {
  const detail = formatChange(value);

  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </p>
      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--border-card)] bg-white p-3 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
        {detail || "-"}
      </pre>
    </div>
  );
}

export function AccountLogsTable({ logs }: AccountLogsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white shadow-[var(--shadow-card)]">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="w-10 px-3 py-3" />
            <th className="w-[26%] px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Action
            </th>
            <th className="w-[34%] px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Function
            </th>
            <th className="w-[16%] px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Detail
            </th>
            <th className="w-[24%] px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const hasDetail =
              Boolean(formatChange(log.beforeChange)) ||
              Boolean(formatChange(log.afterChange));
            const expanded = expandedId === log.id;

            return (
              <Fragment key={log.id}>
                <tr
                  className={`border-b border-[var(--border)] align-top transition-colors last:border-0 ${
                    hasDetail
                      ? "cursor-pointer hover:bg-[var(--primary-light)]/70"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    hasDetail
                      ? setExpandedId((value) =>
                          value === log.id ? null : log.id,
                        )
                      : undefined
                  }
                >
                  <td className="px-3 py-3">
                    {hasDetail ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-card)] bg-white text-[var(--primary)]">
                        {expanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-[var(--text-muted)]">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone="neutral">{log.action}</Badge>
                  </td>
                  <td className="break-words px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {log.functionName}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                    {hasDetail ? "Expandable" : "-"}
                  </td>
                  <td className="break-words px-3 py-3 font-semibold text-[var(--text-secondary)]">
                    {log.time}
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-[var(--border)] bg-[var(--primary-light)]/45">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <ChangeBlock
                          label="Before change"
                          value={log.beforeChange}
                        />
                        <ChangeBlock
                          label="After change"
                          value={log.afterChange}
                        />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
