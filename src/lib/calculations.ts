export type LoanScheduleItem = {
  installmentNo: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  totalDue: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function generateLoanSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: Date,
): LoanScheduleItem[] {
  if (principal <= 0 || annualRate < 0 || termMonths <= 0) {
    return [];
  }

  const monthlyRate = annualRate / 12;
  const emi =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);

  let balance = principal;
  const schedule: LoanScheduleItem[] = [];

  for (let i = 1; i <= termMonths; i += 1) {
    const interest = balance * monthlyRate;
    const principalPay = emi - interest;
    balance -= principalPay;

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installmentNo: i,
      dueDate,
      principalDue: roundMoney(principalPay),
      interestDue: roundMoney(interest),
      totalDue: roundMoney(emi),
    });
  }

  return schedule;
}

export function calculateSavingsInterest(
  principal: number,
  annualRate: number,
  days: number,
): number {
  return roundMoney((principal * annualRate * days) / 365);
}

export function calculateOverdraftFee(
  usedAmount: number,
  annualRate: number,
  days: number,
): number {
  return roundMoney((usedAmount * annualRate * days) / 365);
}
