"use client";

import { useState } from "react";
import { CheckCircle2, Landmark, Pencil, Plus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type ManagedBank = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count: {
    users: number;
    accounts: number;
  };
};

type BankForm = {
  id?: string;
  name: string;
  code: string;
  isActive: boolean;
};

type BankManagementProps = {
  initialBanks: ManagedBank[];
};

const emptyForm: BankForm = {
  name: "",
  code: "",
  isActive: true,
};

export function BankManagement({ initialBanks }: BankManagementProps) {
  const [banks, setBanks] = useState(initialBanks);
  const [form, setForm] = useState<BankForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isEditing = Boolean(form.id);

  async function reloadBanks() {
    const response = await fetch("/api/banks");
    const payload = await response.json();

    if (response.ok) {
      setBanks(payload.data);
    }
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function saveBank() {
    setMessage("");
    setError("");

    const response = await fetch(isEditing ? `/api/banks/${form.id}` : "/api/banks", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code,
        isActive: form.isActive,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Bank could not be saved.");
      return;
    }

    await reloadBanks();
    resetForm();
    setMessage("Bank saved.");
  }

  async function toggleBank(bank: ManagedBank) {
    setMessage("");
    setError("");

    const response = await fetch(`/api/banks/${bank.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !bank.isActive }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Bank status could not be updated.");
      return;
    }

    await reloadBanks();
    setMessage("Bank status updated.");
  }

  function editBank(bank: ManagedBank) {
    setForm({
      id: bank.id,
      name: bank.name,
      code: bank.code,
      isActive: bank.isActive,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            Quản trị Bank
          </h2>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Add, edit and activate or deactivate banks. Bank deletion is not
            available because account transaction history must be preserved.
          </p>
        </div>
        <Button onClick={resetForm} type="button" variant="secondary">
          <Plus size={17} />
          New bank
        </Button>
      </div>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Bank name
            </span>
            <input
              className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              maxLength={100}
              value={form.name}
              onChange={(event) =>
                setForm((value) => ({ ...value, name: event.target.value }))
              }
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Code
            </span>
            <input
              className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] px-3 text-sm font-semibold uppercase outline-none focus:border-[var(--primary)]"
              maxLength={20}
              value={form.code}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  code: event.target.value.toUpperCase(),
                }))
              }
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Status
            </span>
            <select
              className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              value={form.isActive ? "active" : "inactive"}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  isActive: event.target.value === "active",
                }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">In Active</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <Button onClick={saveBank} type="button">
              {isEditing ? <Pencil size={17} /> : <Plus size={17} />}
              {isEditing ? "Save" : "Add"}
            </Button>
            {isEditing ? (
              <Button onClick={resetForm} type="button" variant="secondary">
                Cancel
              </Button>
            ) : null}
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

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[760px] table-auto border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Bank", "Code", "Users", "Accounts", "Status", "Actions"].map(
                (column) => (
                  <th
                    key={column}
                    className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                  >
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {banks.map((bank) => (
              <tr
                key={bank.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--primary-light)]/70"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                      <Landmark size={17} />
                    </div>
                    <span className="font-bold text-[var(--text-primary)]">
                      {bank.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                  {bank.code}
                </td>
                <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                  {bank._count.users}
                </td>
                <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                  {bank._count.accounts}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={bank.isActive ? "done" : "overdue"}>
                    {bank.isActive ? "Active" : "In Active"}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => editBank(bank)}
                      size="icon"
                      title="Edit"
                      type="button"
                      variant="secondary"
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      onClick={() => toggleBank(bank)}
                      size="icon"
                      title={bank.isActive ? "Set inactive" : "Set active"}
                      type="button"
                      variant="secondary"
                    >
                      {bank.isActive ? (
                        <XCircle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
