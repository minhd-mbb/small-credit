"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type StockCrawlerSettingsProps = {
  initialSetting: {
    maxRawLogs: number;
    timeoutMs: number;
    urlTemplate: string;
    waitAfterLoadMs: number;
  };
};

export function StockCrawlerSettings({
  initialSetting,
}: StockCrawlerSettingsProps) {
  const [form, setForm] = useState(initialSetting);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]:
        field === "urlTemplate"
          ? value
          : Number(value.replace(/[^0-9]/g, "")),
    }));
  }

  async function saveSetting() {
    setMessage("");
    setError("");
    setSubmitting(true);
    const response = await fetch("/api/stocks/crawler-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Không thể lưu cấu hình crawler.");
      return;
    }

    setMessage("Đã lưu cấu hình crawler chứng khoán.");
  }

  return (
    <section className="space-y-5">
      <Card>
        <div>
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Đầu tư chứng khoán
          </p>
          <h2 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
            Cấu hình crawler giá
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            URL template bắt buộc có biến {"{symbol}"}. Khi user bấm Đồng bộ giá,
            hệ thống mở browser thật bằng Playwright, bắt XHR/fetch JSON và ghi
            cache.
          </p>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4">
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              URL template
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              value={form.urlTemplate}
              onChange={(event) => updateField("urlTemplate", event.target.value)}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Timeout mỗi mã (ms)
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                max={30000}
                min={5000}
                type="number"
                value={form.timeoutMs}
                onChange={(event) => updateField("timeoutMs", event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Chờ sau load (ms)
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                max={10000}
                min={1000}
                type="number"
                value={form.waitAfterLoadMs}
                onChange={(event) =>
                  updateField("waitAfterLoadMs", event.target.value)
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Raw JSON log tối đa
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                max={50}
                min={1}
                type="number"
                value={form.maxRawLogs}
                onChange={(event) => updateField("maxRawLogs", event.target.value)}
              />
            </label>
          </div>

          <div className="rounded-xl bg-[var(--primary-light)] px-3 py-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            Mặc định: https://finance.vietstock.vn/{"{symbol}"}/thong-ke-giao-dich.htm
          </div>

          {message ? (
            <p className="rounded-xl bg-[var(--status-done)] px-3 py-2 text-sm font-bold text-[var(--status-done-text)]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button disabled={submitting} type="button" onClick={saveSetting}>
              <Save size={17} />
              {submitting ? "Đang lưu" : "Lưu cấu hình"}
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
