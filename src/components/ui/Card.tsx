import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  dark?: boolean;
};

export function Card({ className = "", dark = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] ${dark ? "border-transparent bg-[var(--bg-dark)] text-[var(--text-on-dark)]" : "border-[var(--border-card)] bg-[var(--bg-card)]"} ${className}`}
      {...props}
    />
  );
}
