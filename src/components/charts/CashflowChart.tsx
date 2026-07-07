"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { month: "T1", income: 120, expense: 65 },
  { month: "T2", income: 150, expense: 82 },
  { month: "T3", income: 180, expense: 92 },
  { month: "T4", income: 165, expense: 78 },
];

export function CashflowChart() {
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
          <BarChart data={data}>
            <CartesianGrid stroke="#e5e7e0" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="income" fill="var(--chart-blue)" name="Tiền vào" />
            <Bar dataKey="expense" fill="var(--chart-pink)" name="Tiền ra" />
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
