"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type BaseSavingRateManagementProps = {
  initialRate: string;
  initialUpdatedAt: string | null;
  synchronizedBanks: number;
};

export function BaseSavingRateManagement({
  initialRate,
  initialUpdatedAt,
  synchronizedBanks,
}: BaseSavingRateManagementProps) {
  const [annualRatePercent, setAnnualRatePercent] = useState(initialRate);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [bankCount, setBankCount] = useState(synchronizedBanks);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveBaseRate() {
    setMessage("");
    setError("");

    const rate = Number(annualRatePercent);

    if (!Number.isFinite(rate) || rate < 0 || rate >= 50) {
      setError("Lãi suất cơ bản phải là số hợp lệ và nhỏ hơn 50%.");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/savings/base-rate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annualRatePercent: rate }),
    });
    const payload = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Không thể cập nhật lãi suất cơ bản.");
      return;
    }

    setAnnualRatePercent(payload.data.annualRatePercent);
    setUpdatedAt(payload.data.updatedAt);
    setBankCount(payload.data.synchronizedBanks);
    setMessage("Đã cập nhật lãi suất cơ bản và đồng bộ tới tất cả bank.");
  }

  return (
    <Card>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Lãi suất cơ bản hệ thống
          </p>
          <h2 className="font-display mt-2 text-xl font-bold text-[var(--text-primary)]">
            Áp dụng cho toàn bộ bank
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            Khi Admin cập nhật mức này, phần mềm tự động điều chỉnh lãi suất
            cơ bản của tất cả bank. Bank admin chỉ có thể tăng thêm tối đa 20%
            so với mức cơ bản này.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--primary-light)] p-4">
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Lãi suất (%/năm)
            </span>
            <input
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-lg font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              max={49.99}
              min={0}
              step={0.01}
              type="number"
              value={annualRatePercent}
              onChange={(event) => setAnnualRatePercent(event.target.value)}
            />
          </label>

          <div className="mt-4 grid gap-2 text-sm font-semibold text-[var(--text-secondary)]">
            <p>Đồng bộ: {bankCount} bank</p>
            <p>
              Cập nhật gần nhất:{" "}
              {updatedAt ? new Date(updatedAt).toLocaleString("vi-VN") : "-"}
            </p>
          </div>

          <Button
            className="mt-5 w-full"
            disabled={isSaving}
            type="button"
            onClick={saveBaseRate}
          >
            <Save size={17} />
            {isSaving ? "Đang lưu" : "Lưu lãi suất cơ bản"}
          </Button>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl bg-[var(--status-done)] px-3 py-2 text-sm font-bold text-[var(--status-done-text)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
