type ProgressRingProps = {
  value: number;
  label: string;
  color: string;
};

export function ProgressRing({ value, label, color }: ProgressRingProps) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="8"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-[var(--text-primary)]">
          {value}%
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-[var(--text-secondary)]">
        {label}
      </p>
    </div>
  );
}
