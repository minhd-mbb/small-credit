import type { HTMLAttributes } from "react";

type BadgeTone =
  | "done"
  | "progress"
  | "todo"
  | "income"
  | "expense"
  | "pending"
  | "overdue"
  | "neutral";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  done: "bg-[var(--status-done)] text-[var(--status-done-text)]",
  progress: "bg-[var(--status-progress)] text-[var(--status-progress-text)]",
  todo: "bg-[var(--status-todo)] text-[var(--status-todo-text)]",
  income: "bg-[var(--status-done)] text-[var(--status-done-text)]",
  expense: "bg-red-50 text-red-600",
  pending: "bg-[var(--status-todo)] text-[var(--status-todo-text)]",
  overdue: "bg-red-100 text-red-700",
  neutral: "bg-[var(--primary-light)] text-[var(--primary)]",
};

export function Badge({ className = "", tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-[var(--radius-badge)] px-3 text-xs font-bold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
