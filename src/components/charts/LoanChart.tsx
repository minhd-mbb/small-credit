"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const data = [
  { name: "Đang hoạt động", value: 72, color: "var(--color-primary)" },
  { name: "Chờ xử lý", value: 18, color: "var(--chart-blue)" },
  { name: "Quá hạn", value: 10, color: "var(--chart-pink)" },
];

export function LoanChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="h-72">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={90}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
