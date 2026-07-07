export type Role = "ADMIN" | "BANK_ADMIN" | "ACCOUNT";

export type AccountType = "CHECKING" | "SAVINGS" | "LOAN" | "PLEDGE";

export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER"
  | "INTEREST"
  | "FEE"
  | "REPAYMENT";

export type LoanStatus = "PENDING" | "ACTIVE" | "OVERDUE" | "CLOSED";
