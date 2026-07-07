export const SYSTEM_SAVING_BASE_RATE_ID = "SYSTEM_SAVING_BASE_RATE";
export const BANK_BASIC_RATE_MAX_INCREASE_RATIO = 1.2;

export function getMaxBankBasicRate(systemBaseRate: number) {
  return systemBaseRate * BANK_BASIC_RATE_MAX_INCREASE_RATIO;
}

export function getMaxBankPolicyRate(bankBaseRate: number) {
  return bankBaseRate * BANK_BASIC_RATE_MAX_INCREASE_RATIO;
}

export function clampRateToBankPolicyRange(rate: number, bankBaseRate: number) {
  const maxRate = getMaxBankPolicyRate(bankBaseRate);

  if (rate > maxRate) {
    return maxRate;
  }

  return rate;
}

export function normalizeOptionalBankPolicyRate(
  rate: number | undefined,
  bankBaseRate: number,
) {
  const maxRate = getMaxBankPolicyRate(bankBaseRate);

  if (rate === undefined || !Number.isFinite(rate) || rate > maxRate) {
    return maxRate;
  }

  return rate;
}

export function isBankBasicRateAllowed(
  bankRate: number,
  systemBaseRate: number | null,
) {
  if (systemBaseRate === null) {
    return false;
  }

  const maxRate = getMaxBankBasicRate(systemBaseRate);

  return bankRate >= systemBaseRate && bankRate <= maxRate;
}

export function isBankPolicyRateAllowed(rate: number, bankBaseRate: number) {
  const maxRate = getMaxBankPolicyRate(bankBaseRate);

  return rate >= bankBaseRate && rate <= maxRate;
}
