"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Role = "ADMIN" | "BANK_ADMIN" | "ACCOUNT";

const roles: Role[] = ["ADMIN", "BANK_ADMIN", "ACCOUNT"];

function isRole(value: string): value is Role {
  return roles.some((role) => role === value);
}

type ManagedAccount = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  bankId: string | null;
  bankName: string | null;
  isActive: boolean;
  resetPasswordRequested: boolean;
};

type BankOption = {
  id: string;
  name: string;
};

type AccountFormState = {
  id?: string;
  username: string;
  fullName: string;
  role: Role;
  bankId: string;
  password: string;
  isActive: boolean;
};

type ResetState = {
  account: ManagedAccount;
  mode: "random" | "custom";
  password: string;
};

type AccountsManagerProps = {
  initialAccounts: ManagedAccount[];
  banks: BankOption[];
  currentUser: {
    role: Role;
    bankId: string | null;
  };
};

const emptyForm: AccountFormState = {
  username: "",
  fullName: "",
  role: "ACCOUNT",
  bankId: "",
  password: "",
  isActive: true,
};

function roleLabel(role: Role) {
  if (role === "BANK_ADMIN") {
    return "Bank admin";
  }

  if (role === "ADMIN") {
    return "Admin";
  }

  return "Account";
}

export function AccountsManager({
  initialAccounts,
  banks,
  currentUser,
}: AccountsManagerProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<AccountFormState>({
    ...emptyForm,
    bankId: currentUser.bankId ?? banks[0]?.id ?? "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetState, setResetState] = useState<ResetState | null>(null);
  const canChooseBank = currentUser.role === "ADMIN";
  const canChooseRole = currentUser.role === "ADMIN";
  const isEditing = Boolean(form.id);

  const selectedBankName = useMemo(
    () => banks.find((bank) => bank.id === form.bankId)?.name ?? "",
    [banks, form.bankId],
  );

  function resetForm() {
    setForm({
      ...emptyForm,
      bankId: currentUser.bankId ?? banks[0]?.id ?? "",
      role: currentUser.role === "BANK_ADMIN" ? "ACCOUNT" : "ACCOUNT",
    });
  }

  async function reloadAccounts() {
    const response = await fetch("/api/accounts");
    const payload = await response.json();

    if (response.ok) {
      setAccounts(payload.data);
    }
  }

  async function submitAccount() {
    setError("");
    setMessage("");

    const url = isEditing ? `/api/accounts/${form.id}` : "/api/accounts";
    const method = isEditing ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username,
        fullName: form.fullName,
        role: canChooseRole ? form.role : "ACCOUNT",
        bankId: canChooseBank ? form.bankId : currentUser.bankId,
        password: form.password || undefined,
        isActive: form.isActive,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Account could not be saved.");
      return;
    }

    await reloadAccounts();
    resetForm();
    setMessage(
      payload.temporaryPassword
        ? `Account saved. Temporary password: ${payload.temporaryPassword}`
        : "Account saved.",
    );
  }

  async function updateAccount(
    account: ManagedAccount,
    data: Partial<ManagedAccount>,
  ) {
    setError("");
    setMessage("");

    const response = await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Account could not be updated.");
      return;
    }

    await reloadAccounts();
    setMessage("Account updated.");
  }

  async function deleteAccount(account: ManagedAccount) {
    setError("");
    setMessage("");

    const response = await fetch(`/api/accounts/${account.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Account could not be deleted.");
      return;
    }

    setAccounts((items) => items.filter((item) => item.id !== account.id));
    setMessage("Account deleted.");
  }

  async function resetPassword() {
    if (!resetState) {
      return;
    }

    setError("");
    setMessage("");

    const response = await fetch(
      `/api/accounts/${resetState.account.id}/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: resetState.mode,
          password:
            resetState.mode === "custom" ? resetState.password : undefined,
        }),
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Password could not be reset.");
      return;
    }

    await reloadAccounts();
    setMessage(`New password for ${resetState.account.username}: ${payload.data.newPassword}`);
    setResetState(null);
  }

  function editAccount(account: ManagedAccount) {
    setForm({
      id: account.id,
      username: account.username,
      fullName: account.fullName,
      role: account.role,
      bankId: account.bankId ?? "",
      password: "",
      isActive: account.isActive,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            Account management
          </h2>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Create, edit, delete, activate and reset login accounts.
          </p>
        </div>
        <Button onClick={resetForm} type="button" variant="secondary">
          <Plus size={17} />
          New account
        </Button>
      </div>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_0.85fr_0.85fr]">
          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Username
            </span>
            <input
              className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              inputMode="numeric"
              maxLength={10}
              value={form.username}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  username: event.target.value.replace(/\D/g, ""),
                }))
              }
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Full Name
            </span>
            <input
              className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              maxLength={100}
              value={form.fullName}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  fullName: event.target.value,
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

          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Role
            </span>
            <select
              className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)] disabled:bg-gray-50"
              disabled={!canChooseRole}
              value={form.role}
              onChange={(event) => {
                const nextRole = event.target.value;

                if (!isRole(nextRole)) {
                  return;
                }

                setForm((value) => ({
                  ...value,
                  role: nextRole,
                }));
              }}
            >
              <option value="ACCOUNT">Account</option>
              <option value="BANK_ADMIN">Bank admin</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Bank
            </span>
            {canChooseBank ? (
              <select
                className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                value={form.bankId}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    bankId: event.target.value,
                  }))
                }
              >
                <option value="">No bank</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-2 flex h-10 items-center rounded-[var(--radius-btn)] border border-[var(--border-card)] bg-gray-50 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                {selectedBankName || "Assigned bank"}
              </div>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              {isEditing ? "New Password" : "Password"}
            </span>
            <input
              className="mt-2 h-10 w-full rounded-[var(--radius-btn)] border border-[var(--border-card)] px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              placeholder={isEditing ? "Use Reset password after saving" : "Blank = random"}
              type="text"
              value={form.password}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  password: event.target.value,
                }))
              }
            />
          </label>

          <div className="flex items-end gap-2">
            <Button onClick={submitAccount} type="button">
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

      {resetState ? (
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Reset password
              </p>
              <h3 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
                {resetState.account.fullName} / {resetState.account.username}
              </h3>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <select
                className="h-10 rounded-[var(--radius-btn)] border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                value={resetState.mode}
                onChange={(event) => {
                  const nextMode = event.target.value;

                  if (nextMode !== "random" && nextMode !== "custom") {
                    return;
                  }

                  setResetState((value) =>
                    value
                      ? { ...value, mode: nextMode }
                      : value,
                  );
                }}
              >
                <option value="random">Random password</option>
                <option value="custom">Custom password</option>
              </select>
              {resetState.mode === "custom" ? (
                <input
                  className="h-10 rounded-[var(--radius-btn)] border border-[var(--border-card)] px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                  placeholder="New password"
                  type="text"
                  value={resetState.password}
                  onChange={(event) =>
                    setResetState((value) =>
                      value ? { ...value, password: event.target.value } : value,
                    )
                  }
                />
              ) : null}
              <Button onClick={resetPassword} type="button">
                <RefreshCw size={17} />
                Reset
              </Button>
              <Button
                onClick={() => setResetState(null)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-card)] bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[920px] table-auto border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {[
                "Username",
                "Full Name",
                "Role",
                "Bank",
                "Active",
                "Reset",
                "Actions",
              ].map((column) => (
                <th
                  key={column}
                  className="px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--primary-light)]/70"
              >
                <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                  {account.username}
                </td>
                <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                  {account.fullName}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={account.role === "ADMIN" ? "done" : "neutral"}>
                    {roleLabel(account.role)}
                  </Badge>
                </td>
                <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                  {account.bankName ?? "All banks"}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={account.isActive ? "done" : "overdue"}>
                    {account.isActive ? "Active" : "In Active"}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  {account.resetPasswordRequested ? (
                    <Badge tone="pending">Đợi reset mật khẩu</Badge>
                  ) : (
                    <Badge tone="neutral">No request</Badge>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => editAccount(account)}
                      size="icon"
                      title="Edit"
                      type="button"
                      variant="secondary"
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      onClick={() =>
                        updateAccount(account, {
                          isActive: !account.isActive,
                        })
                      }
                      size="icon"
                      title={account.isActive ? "Set inactive" : "Set active"}
                      type="button"
                      variant="secondary"
                    >
                      {account.isActive ? (
                        <XCircle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </Button>
                    <Button
                      onClick={() =>
                        setResetState({
                          account,
                          mode: "random",
                          password: "",
                        })
                      }
                      size="icon"
                      title="Reset password"
                      type="button"
                      variant="secondary"
                    >
                      <KeyRound size={16} />
                    </Button>
                    <Button
                      onClick={() => deleteAccount(account)}
                      size="icon"
                      title="Delete"
                      type="button"
                      variant="secondary"
                    >
                      <Trash2 size={16} />
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
