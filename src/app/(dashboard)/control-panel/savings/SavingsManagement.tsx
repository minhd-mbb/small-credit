"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  getMaxBankBasicRate,
  getMaxBankPolicyRate,
  isBankBasicRateAllowed,
} from "@/lib/savings-policy";

type PolicyType = "BASIC" | "PERIOD" | "PROMOTIONAL";

type BankOption = {
  id: string;
  name: string;
};

type SavingPolicy = {
  id: string;
  bankId: string;
  bankName: string;
  type: PolicyType;
  annualRatePercent: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
};

type PolicyForm = {
  id?: string;
  bankId: string;
  type: PolicyType;
  annualRatePercent: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type SavingsManagementProps = {
  banks: BankOption[];
  currentBankId: string | null;
  initialPolicies: SavingPolicy[];
  initialSystemBaseRate: string | null;
  role: "ADMIN" | "BANK_ADMIN";
};

const policyLabels: Record<PolicyType, string> = {
  BASIC: "Lãi suất cơ bản",
  PERIOD: "Lãi suất theo thời kỳ",
  PROMOTIONAL: "Lãi suất ưu đãi",
};

const policyDescriptions: Record<PolicyType, string> = {
  BASIC:
    "Mức cơ bản do Admin thiết lập cho toàn hệ thống. Bank admin chỉ được tăng thêm tối đa 20%.",
  PERIOD:
    "Áp dụng trong khoảng thời gian có ngày bắt đầu và ngày kết thúc.",
  PROMOTIONAL:
    "Lãi suất thưởng do bank admin áp dụng cho các khoản tiết kiệm đang hoạt động.",
};

function getDefaultPolicyType(role: "ADMIN" | "BANK_ADMIN"): PolicyType {
  return role === "ADMIN" ? "PERIOD" : "BASIC";
}

function emptyForm(
  bankId: string | null,
  role: "ADMIN" | "BANK_ADMIN",
): PolicyForm {
  return {
    bankId: bankId ?? "",
    type: getDefaultPolicyType(role),
    annualRatePercent: "",
    startDate: "",
    endDate: "",
    isActive: true,
  };
}

function dateForInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatRate(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function SavingsManagement({
  banks,
  currentBankId,
  initialPolicies,
  initialSystemBaseRate,
  role,
}: SavingsManagementProps) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [systemBaseRate, setSystemBaseRate] = useState(initialSystemBaseRate);
  const [form, setForm] = useState<PolicyForm>(
    emptyForm(currentBankId, role),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isEditing = Boolean(form.id);
  const canSelectBank = role === "ADMIN";
  const systemBaseRateNumber =
    systemBaseRate === null ? null : Number(systemBaseRate);
  const maxBankBasicRate =
    systemBaseRateNumber === null
      ? null
      : getMaxBankBasicRate(systemBaseRateNumber);
  const selectedBankBaseRate = getSelectedBankBaseRate();
  const selectedBankPolicyMaxRate =
    selectedBankBaseRate === null
      ? null
      : getMaxBankPolicyRate(selectedBankBaseRate);
  const availablePolicyTypes: PolicyType[] =
    role === "ADMIN" ? ["PERIOD", "PROMOTIONAL"] : ["BASIC", "PERIOD", "PROMOTIONAL"];

  function getSelectedBankBaseRate() {
    const targetBankId = canSelectBank ? form.bankId : currentBankId;
    const bankBasicPolicy = policies.find(
      (policy) => policy.bankId === targetBankId && policy.type === "BASIC",
    );

    if (bankBasicPolicy) {
      return Number(bankBasicPolicy.annualRatePercent);
    }

    return systemBaseRateNumber;
  }

  async function reloadPolicies() {
    const response = await fetch("/api/savings/policies");
    const payload = await response.json();

    if (response.ok) {
      setPolicies(payload.data ?? []);
      setSystemBaseRate(payload.systemBaseRate ?? null);
    }
  }

  function resetForm(type: PolicyType = getDefaultPolicyType(role)) {
    setForm({
      ...emptyForm(currentBankId, role),
      bankId: canSelectBank ? banks[0]?.id ?? "" : currentBankId ?? "",
      type: role === "ADMIN" && type === "BASIC" ? "PERIOD" : type,
    });
  }

  async function savePolicy() {
    setMessage("");
    setError("");

    const isRateBlank = form.annualRatePercent.trim() === "";
    const rate = isRateBlank ? undefined : Number(form.annualRatePercent);

    if (
      rate !== undefined &&
      (!Number.isFinite(rate) || rate < 0 || rate >= 50)
    ) {
      setError("Lãi suất phải là số hợp lệ và nhỏ hơn 50%.");
      return;
    }

    if (role === "ADMIN" && form.type === "BASIC") {
      setError("Admin điều chỉnh lãi suất cơ bản tại menu Lãi suất cơ bản.");
      return;
    }

    if (form.type === "BASIC" && role === "BANK_ADMIN") {
      if (systemBaseRateNumber === null || maxBankBasicRate === null) {
        setError("Admin chưa cấu hình lãi suất cơ bản hệ thống.");
        return;
      }

      if (
        rate !== undefined &&
        !isBankBasicRateAllowed(rate, systemBaseRateNumber)
      ) {
        setError(
          `Lãi suất cơ bản của bank phải từ ${formatRate(systemBaseRateNumber)}% đến ${formatRate(maxBankBasicRate)}%.`,
        );
        return;
      }
    }

    if (form.type !== "BASIC") {
      if (selectedBankBaseRate === null || selectedBankPolicyMaxRate === null) {
        setError("ChÆ°a cáº¥u hÃ¬nh lÃ£i suáº¥t cÆ¡ báº£n cá»§a bank.");
        return;
      }

      if (rate !== undefined && rate < selectedBankBaseRate) {
        setError(
          `LÃ£i suáº¥t khÃ´ng Ä‘Æ°á»£c tháº¥p hÆ¡n lÃ£i suáº¥t cÆ¡ báº£n cá»§a bank (${formatRate(selectedBankBaseRate)}%).`,
        );
        return;
      }
    }

    if (form.type === "PERIOD" && (!form.startDate || !form.endDate)) {
      setError("Lãi suất theo thời kỳ cần ngày bắt đầu và ngày kết thúc.");
      return;
    }

    const response = await fetch(
      isEditing ? `/api/savings/policies/${form.id}` : "/api/savings/policies",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: form.bankId || undefined,
          type: form.type,
          annualRatePercent: rate ?? null,
          startDate: form.type === "PERIOD" ? form.startDate : null,
          endDate: form.type === "PERIOD" ? form.endDate : null,
          isActive: form.isActive,
        }),
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Không thể lưu lãi suất tiết kiệm.");
      return;
    }

    await reloadPolicies();
    resetForm(form.type);
    setMessage("Đã lưu lãi suất tiết kiệm.");
  }

  function editPolicy(policy: SavingPolicy) {
    setForm({
      id: policy.id,
      bankId: policy.bankId,
      type: policy.type,
      annualRatePercent: policy.annualRatePercent,
      startDate: dateForInput(policy.startDate),
      endDate: dateForInput(policy.endDate),
      isActive: policy.isActive,
    });
    setMessage("");
    setError("");
  }

  async function deletePolicy(policy: SavingPolicy) {
    if (policy.type === "BASIC") {
      setError("Không thể xóa lãi suất cơ bản.");
      return;
    }

    if (!window.confirm(`Xóa ${policyLabels[policy.type]}?`)) {
      return;
    }

    setMessage("");
    setError("");

    const response = await fetch(`/api/savings/policies/${policy.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Không thể xóa lãi suất tiết kiệm.");
      return;
    }

    await reloadPolicies();
    setMessage("Đã xóa lãi suất tiết kiệm.");
  }

  return (
    <div className="space-y-5">
      {role === "BANK_ADMIN" ? (
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Giới hạn lãi suất cơ bản
              </p>
              <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
                Admin base: {systemBaseRate ?? "Chưa cấu hình"}%
              </h2>
              <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                Bank admin được tăng thêm tối đa 20%
                {maxBankBasicRate === null
                  ? "."
                  : `, tương đương tối đa ${formatRate(maxBankBasicRate)}%.`}
              </p>
            </div>
            <Badge tone="neutral">Bank scope</Badge>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Cấu hình lãi suất
            </p>
            <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
              {isEditing ? "Sửa lãi suất tiết kiệm" : "Thêm lãi suất tiết kiệm"}
            </h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => resetForm(form.type)}
          >
            Reset
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {canSelectBank ? (
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Bank
              </span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                value={form.bankId}
                onChange={(event) =>
                  setForm((value) => ({ ...value, bankId: event.target.value }))
                }
              >
                <option value="">Chọn bank</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Nhóm lãi suất
            </span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)] disabled:bg-[var(--primary-light)]"
              disabled={isEditing && form.type === "BASIC"}
              value={form.type}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  type: event.target.value as PolicyType,
                }))
              }
            >
              {availablePolicyTypes.map((value) => (
                <option key={value} value={value}>
                  {policyLabels[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Lãi suất (%/năm)
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              max={
                form.type === "BASIC" && maxBankBasicRate
                  ? maxBankBasicRate
                  : form.type !== "BASIC" && selectedBankPolicyMaxRate
                    ? selectedBankPolicyMaxRate
                    : 49.99
              }
              min={
                form.type === "BASIC" && systemBaseRateNumber
                  ? systemBaseRateNumber
                  : form.type !== "BASIC" && selectedBankBaseRate
                    ? selectedBankBaseRate
                    : 0
              }
              step={0.01}
              type="number"
              value={form.annualRatePercent}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  annualRatePercent: event.target.value,
                }))
              }
            />
            {form.type !== "BASIC" && selectedBankBaseRate !== null ? (
              <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                Bá» trá»‘ng hoáº·c vÆ°á»£t tráº§n sáº½ tá»± Ã¡p dá»¥ng tá»‘i Ä‘a{" "}
                {formatRate(getMaxBankPolicyRate(selectedBankBaseRate))}%.
              </p>
            ) : null}
          </label>

          {form.type === "PERIOD" ? (
            <>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                  Ngày bắt đầu
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                  Ngày kết thúc
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      endDate: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : null}

          <label className="flex items-end gap-2">
            <input
              checked={form.isActive}
              className="mb-3 h-4 w-4 accent-[var(--primary)]"
              type="checkbox"
              onChange={(event) =>
                setForm((value) => ({ ...value, isActive: event.target.checked }))
              }
            />
            <span className="pb-2 text-sm font-bold text-[var(--text-primary)]">
              Active
            </span>
          </label>

          <div className="flex items-end">
            <Button type="button" onClick={savePolicy}>
              {isEditing ? <Pencil size={17} /> : <Plus size={17} />}
              {isEditing ? "Lưu" : "Thêm"}
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

      {(Object.keys(policyLabels) as PolicyType[]).map((type) => {
        const group = policies.filter((policy) => policy.type === type);

        return (
          <Card key={type}>
            <div className="mb-4">
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {policyLabels[type]}
              </h2>
              <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                {policyDescriptions[type]}
              </p>
            </div>

            {group.length === 0 ? (
              <p className="rounded-xl bg-[var(--primary-light)] px-3 py-3 text-sm font-semibold text-[var(--primary)]">
                Chưa có cấu hình lãi suất.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border-card)]">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
                      {[
                        "Bank",
                        "Lãi suất",
                        "Thời gian áp dụng",
                        "Trạng thái",
                        "Actions",
                      ].map((column) => (
                        <th
                          key={column}
                          className="px-3 py-3 text-xs font-bold uppercase text-[var(--text-muted)]"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((policy) => {
                      const canEditPolicy =
                        policy.type !== "BASIC" || role === "BANK_ADMIN";
                      const canDeletePolicy = policy.type !== "BASIC";

                      return (
                        <tr
                          key={policy.id}
                          className="border-b border-[var(--border-card)] last:border-0"
                        >
                          <td className="px-3 py-3 font-bold text-[var(--text-primary)]">
                            {policy.bankName}
                          </td>
                          <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                            {policy.annualRatePercent}%/năm
                          </td>
                          <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                            {policy.type === "PERIOD"
                              ? `${dateForInput(policy.startDate)} - ${dateForInput(policy.endDate)}`
                              : "-"}
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={policy.isActive ? "done" : "overdue"}>
                              {policy.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              {canEditPolicy ? (
                                <Button
                                  size="icon"
                                  type="button"
                                  variant="secondary"
                                  onClick={() => editPolicy(policy)}
                                >
                                  <Pencil size={16} />
                                </Button>
                              ) : null}
                              {canDeletePolicy ? (
                                <Button
                                  size="icon"
                                  type="button"
                                  variant="secondary"
                                  onClick={() => deletePolicy(policy)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
