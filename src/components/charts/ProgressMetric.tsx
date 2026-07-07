const metrics = [
  { label: "Low risk", value: 78, color: "var(--status-done-text)" },
  { label: "In review", value: 54, color: "var(--primary)" },
  { label: "Overdue", value: 12, color: "var(--chart-pink)" },
];

export function ProgressMetric() {
  return (
    <div className="grid gap-5 md:grid-cols-[160px_1fr]">
      <div>
        <span className="font-display text-3xl font-bold text-[var(--text-primary)]">
          94%
        </span>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          portfolio health
        </p>
      </div>
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center gap-3">
            <span className="w-20 text-xs font-semibold text-[var(--text-secondary)]">
              {metric.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${metric.value}%`,
                  background: metric.color,
                }}
              />
            </div>
            <span className="w-9 text-right text-xs font-bold text-[var(--text-primary)]">
              {metric.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
