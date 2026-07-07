const data = [
  { day: "Mon", value: 7.2 },
  { day: "Tue", value: 8.1 },
  { day: "Wed", value: 7.75 },
  { day: "Thu", value: 5.3, active: true },
  { day: "Fri", value: 3.2 },
  { day: "Sat", value: 1.5 },
  { day: "Sun", value: 0 },
];

function formatHours(value: number) {
  if (!value) {
    return "0:00";
  }

  const hours = Math.floor(value);
  const minutes = Math.round((value % 1) * 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function WeeklyBarChart() {
  const max = Math.max(...data.map((item) => item.value));

  return (
    <div className="flex h-44 items-end gap-3 pt-2">
      {data.map((item, index) => {
        const height = max > 0 ? (item.value / max) * 100 : 0;

        return (
          <div
            key={item.day}
            className="flex h-full flex-1 flex-col items-center gap-2"
            style={{ animation: `slideUp 0.4s ease ${index * 0.05}s both` }}
          >
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
              {formatHours(item.value)}
            </span>
            <div className="flex min-h-0 w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-md transition-all ${
                  item.active
                    ? "bg-[var(--color-primary-lt)]"
                    : item.value
                      ? "bg-[var(--color-primary)]"
                      : "bg-[var(--chart-blue-light)]"
                }`}
                style={{ height: `${Math.max(height, item.value ? 8 : 4)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {item.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}
