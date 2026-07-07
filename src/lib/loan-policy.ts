export const SYSTEM_LOAN_BASE_RATE_ID = "SYSTEM_LOAN_BASE_RATE";
export const LOAN_RATE_MIN_RATIO = 0.8;
export const LOAN_RATE_MAX_RATIO = 1.2;

export function getMinLoanBankBaseRate(systemBaseRate: number) {
  return systemBaseRate * LOAN_RATE_MIN_RATIO;
}

export function getMaxLoanBankBaseRate(systemBaseRate: number) {
  return systemBaseRate * LOAN_RATE_MAX_RATIO;
}

export function getMinLoanTermRate(bankBaseRate: number) {
  return bankBaseRate * LOAN_RATE_MIN_RATIO;
}

export function getMaxLoanTermRate(bankBaseRate: number) {
  return bankBaseRate * LOAN_RATE_MAX_RATIO;
}

export function clampLoanRateToRange(
  rate: number | undefined,
  baseRate: number,
) {
  const minRate = getMinLoanTermRate(baseRate);
  const maxRate = getMaxLoanTermRate(baseRate);

  if (rate === undefined || !Number.isFinite(rate)) {
    return baseRate;
  }

  return Math.min(Math.max(rate, minRate), maxRate);
}

export function clampLoanBankBaseRate(
  rate: number | undefined,
  systemBaseRate: number,
) {
  const minRate = getMinLoanBankBaseRate(systemBaseRate);
  const maxRate = getMaxLoanBankBaseRate(systemBaseRate);

  if (rate === undefined || !Number.isFinite(rate)) {
    return systemBaseRate;
  }

  return Math.min(Math.max(rate, minRate), maxRate);
}

export function roundLoanRate(value: number) {
  return Math.round(value * 100) / 100;
}
