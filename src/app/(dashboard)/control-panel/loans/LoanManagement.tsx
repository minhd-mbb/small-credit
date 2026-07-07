"use client";

import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AccountPicker,
  accountPickerLabel,
  type PickedAccount,
} from "@/components/accounts/AccountPicker";
import { MoneyAmountInput } from "@/components/forms/MoneyAmountInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type PolicyType = "BASIC" | "TERM";

type LoanPolicy = {
  id: string;
  bankId: string;
  bankName: string;
  type: PolicyType;
  annualRatePercent: string;
  termMonths: number | null;
  isActive: boolean;
};

type LoanManagementProps = {
  banks: { id: string; name: string }[];
  currentBankId: string | null;
  initialPolicies: LoanPolicy[];
  role: "ADMIN" | "BANK_ADMIN";
};

const termOptions = [1, 2, 3, 6, 12, 24, 36];

export function LoanManagement({
  banks,
  currentBankId,
  initialPolicies,
  role,
}: LoanManagementProps) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [bankId, setBankId] = useState(currentBankId ?? banks[0]?.id ?? "");
  const [type, setType] = useState<PolicyType>(
    role === "ADMIN" ? "TERM" : "BASIC",
  );
  const [termMonths, setTermMonths] = useState(12);
  const [annualRatePercent, setAnnualRatePercent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [accountInput, setAccountInput] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<PickedAccount | null>(null);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTermMonths, setLoanTermMonths] = useState(12);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canSelectBank = role === "ADMIN";
  const selectedLabel = selectedAccount ? accountPickerLabel(selectedAccount) : "";
  const isEditingPolicy = Boolean(policyId);

  async function reloadPolicies() {
    const response = await fetch("/api/loans/policies");
    const payload = await response.json();

    if (response.ok) {
      setPolicies(payload.data ?? []);
    }
  }

  function resetPolicyForm(nextType: PolicyType = role === "ADMIN" ? "TERM" : "BASIC") {
    setPolicyId(null);
    setBankId(currentBankId ?? banks[0]?.id ?? "");
    setType(nextType);
    setTermMonths(12);
    setAnnualRatePercent("");
    setIsActive(true);
  }

  function editPolicy(policy: LoanPolicy) {
    setPolicyId(policy.id);
    setBankId(policy.bankId);
    setType(policy.type);
    setTermMonths(policy.termMonths ?? 12);
    setAnnualRatePercent(policy.annualRatePercent);
    setIsActive(policy.isActive);
  }

  async function savePolicy() {
    setMessage("");
    setError("");

    const rate = annualRatePercent.trim() ? Number(annualRatePercent) : null;

    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate >= 50)) {
      setError("Lãi suất vay phải là số hợp lệ và nhỏ hơn 50%.");
      return;
    }

    if (type === "BASIC" && role === "ADMIN") {
      setError("Admin điều chỉnh lãi suất vay cơ bản tại menu riêng.");
      return;
    }

    const response = await fetch(
      isEditingPolicy ? `/api/loans/policies/${policyId}` : "/api/loans/policies",
      {
        method: isEditingPolicy ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId,
          type,
          annualRatePercent: rate,
          termMonths: type === "TERM" ? termMonths : null,
          isActive,
        }),
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Không thể lưu lãi suất vay.");
      return;
    }

    await reloadPolicies();
    resetPolicyForm(type);
    setMessage("Đã lưu lãi suất vay.");
  }

  async function deletePolicy(policy: LoanPolicy) {
    if (policy.type === "BASIC") {
      setError("Không thể xóa lãi suất vay cơ bản.");
      return;
    }

    if (!window.confirm("Xóa lãi suất vay theo kỳ hạn?")) {
      return;
    }

    const response = await fetch(`/api/loans/policies/${policy.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Không thể xóa lãi suất vay.");
      return;
    }

    await reloadPolicies();
    setMessage("Đã xóa lãi suất vay.");
  }

  async function createLoan() {
    setMessage("");
    setError("");

    if (!selectedAccount || accountInput.trim() !== selectedLabel) {
      setError("Số tài khoản không tồn tại.");
      return;
    }

    const amount = Number(loanAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Số tiền vay không hợp lệ.");
      return;
    }

    const response = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientAccountNo: selectedAccount.accountNo,
        amount,
        termMonths: loanTermMonths,
        note,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Không thể tạo hợp đồng vay.");
      return;
    }

    setLoanAmount("");
    setAccountInput("");
    setSelectedAccount(null);
    setNote("");
    setMessage("Đã tạo hợp đồng vay và giải ngân.");
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Cấu hình lãi suất vay
            </p>
            <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
              {isEditingPolicy ? "Sửa lãi suất vay" : "Thêm lãi suất vay"}
            </h2>
          </div>
          <Button type="button" variant="secondary" onClick={() => resetPolicyForm()}>
            Reset
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {canSelectBank ? (
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Bank</span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                value={bankId}
                onChange={(event) => setBankId(event.target.value)}
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Loại lãi suất</span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)] disabled:bg-[var(--primary-light)]"
              disabled={isEditingPolicy && type === "BASIC"}
              value={type}
              onChange={(event) => setType(event.target.value as PolicyType)}
            >
              {role === "BANK_ADMIN" ? <option value="BASIC">Cơ bản bank</option> : null}
              <option value="TERM">Theo kỳ hạn</option>
            </select>
          </label>

          {type === "TERM" ? (
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Kỳ hạn</span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                value={termMonths}
                onChange={(event) => setTermMonths(Number(event.target.value))}
              >
                {termOptions.map((term) => (
                  <option key={term} value={term}>
                    {term} tháng
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
              Lãi suất (%/năm)
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              placeholder="Bỏ trống = tự clamp"
              type="number"
              value={annualRatePercent}
              onChange={(event) => setAnnualRatePercent(event.target.value)}
            />
          </label>

          <label className="flex items-end gap-2">
            <input
              checked={isActive}
              className="mb-3 h-4 w-4 accent-[var(--primary)]"
              type="checkbox"
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span className="pb-2 text-sm font-bold text-[var(--text-primary)]">Active</span>
          </label>

          <div className="flex items-end">
            <Button type="button" onClick={savePolicy}>
              {isEditingPolicy ? <Pencil size={17} /> : <Plus size={17} />}
              {isEditingPolicy ? "Lưu" : "Thêm"}
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

      <Card>
        <div className="mb-5">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Tạo hợp đồng vay
          </p>
          <h2 className="font-display mt-1 text-lg font-bold text-[var(--text-primary)]">
            Giải ngân từ Quỹ bank
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <AccountPicker
            inputValue={accountInput}
            label="Tài khoản nhận giải ngân"
            onInputChange={setAccountInput}
            onSelect={setSelectedAccount}
            scope="deposit"
            value={selectedAccount}
          />
          <MoneyAmountInput value={loanAmount} onChange={setLoanAmount} />
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Kỳ hạn</span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              value={loanTermMonths}
              onChange={(event) => setLoanTermMonths(Number(event.target.value))}
            >
              {termOptions.map((term) => (
                <option key={term} value={term}>
                  {term} tháng
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Ghi chú</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-card)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={createLoan}>
              <Landmark size={17} />
              Tạo vay
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
          Danh sách lãi suất vay
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-card)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-card)] bg-[var(--primary-light)]">
                {["Bank", "Loại", "Kỳ hạn", "Lãi suất", "Trạng thái", "Actions"].map((column) => (
                  <th key={column} className="px-3 py-3 text-xs font-bold uppercase text-[var(--text-muted)]">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id} className="border-b border-[var(--border-card)] last:border-0">
                  <td className="px-3 py-3 font-bold text-[var(--text-primary)]">{policy.bankName}</td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {policy.type === "BASIC" ? "Cơ bản" : "Theo kỳ hạn"}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-secondary)]">
                    {policy.termMonths ? `${policy.termMonths} tháng` : "-"}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {policy.annualRatePercent}%/năm
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={policy.isActive ? "done" : "overdue"}>
                      {policy.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      {policy.type !== "BASIC" || role === "BANK_ADMIN" ? (
                        <Button size="icon" type="button" variant="secondary" onClick={() => editPolicy(policy)}>
                          <Pencil size={16} />
                        </Button>
                      ) : null}
                      {policy.type !== "BASIC" ? (
                        <Button size="icon" type="button" variant="secondary" onClick={() => deletePolicy(policy)}>
                          <Trash2 size={16} />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
