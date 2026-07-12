export const STANDARD_SAVING_TERMS = [1, 2, 3, 6, 12] as const;

export type StandardSavingTerm = (typeof STANDARD_SAVING_TERMS)[number];

type DailyAccrualInput = {
  principal: number;
  annualRatePercent: number;
  days?: number;
};

type EarlyWithdrawalInput = {
  accruedInterest: number;
  basicAnnualRatePercent: number;
  contractedAnnualRatePercent: number;
  daysHeld: number;
  principal: number;
  withdrawAmount: number;
};

export function isStandardSavingTerm(
  termMonths: number,
): termMonths is StandardSavingTerm {
  return STANDARD_SAVING_TERMS.some((term) => term === termMonths);
}

export function calculateDailySavingInterest({
  principal,
  annualRatePercent,
  days = 1,
}: DailyAccrualInput) {
  if (principal <= 0 || annualRatePercent <= 0 || days <= 0) {
    return 0;
  }

  return (principal * (annualRatePercent / 100) * days) / 365;
}

export function calculateEarlyWithdrawal({
  accruedInterest,
  basicAnnualRatePercent,
  contractedAnnualRatePercent,
  daysHeld,
  principal,
  withdrawAmount,
}: EarlyWithdrawalInput) {
  const normalizedWithdrawAmount = Math.min(Math.max(withdrawAmount, 0), principal);
  const isFullWithdrawal = normalizedWithdrawAmount >= principal;
  const basicInterestForWithdrawnAmount = calculateDailySavingInterest({
    principal: normalizedWithdrawAmount,
    annualRatePercent: basicAnnualRatePercent,
    days: daysHeld,
  });

  if (isFullWithdrawal) {
    return {
      interestPaid: basicInterestForWithdrawnAmount,
      remainingAccruedInterest: 0,
      remainingPrincipal: 0,
      rateForWithdrawnAmount: basicAnnualRatePercent,
    };
  }

  const withdrawnRatio = principal > 0 ? normalizedWithdrawAmount / principal : 0;
  const accruedInterestForWithdrawnAmount = accruedInterest * withdrawnRatio;
  const remainingAccruedInterest = Math.max(
    accruedInterest - accruedInterestForWithdrawnAmount,
    0,
  );

  return {
    interestPaid: basicInterestForWithdrawnAmount,
    remainingAccruedInterest,
    remainingPrincipal: principal - normalizedWithdrawAmount,
    rateForRemainingAmount: contractedAnnualRatePercent,
    rateForWithdrawnAmount: basicAnnualRatePercent,
  };
}

export function calculateInterestAfterRateChange({
  annualRatePercent,
  effectiveDate,
  fromDate,
  principal,
  toDate,
}: {
  annualRatePercent: number;
  effectiveDate: Date;
  fromDate: Date;
  principal: number;
  toDate: Date;
}) {
  const accrualStart = new Date(
    Math.max(fromDate.getTime(), effectiveDate.getTime()),
  );
  const days = Math.max(
    Math.floor((toDate.getTime() - accrualStart.getTime()) / 86_400_000),
    0,
  );

  return calculateDailySavingInterest({
    principal,
    annualRatePercent,
    days,
  });
}
