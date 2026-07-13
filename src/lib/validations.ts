import { z } from "zod";

const hasValidCurrencyPrecision = (value: number): boolean =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;

export const moneyAmountSchema = z.coerce
  .number()
  .positive()
  .refine(hasValidCurrencyPrecision, {
    message: "Amount must have at most two decimal places.",
  });
export const transferAmountSchema = z.coerce
  .number()
  .positive()
  .max(1_000_000_000)
  .refine(hasValidCurrencyPrecision, {
    message: "Amount must have at most two decimal places.",
  });

export const accountEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(100)
  .email("Email must be a valid email address.");

export const usernameSchema = accountEmailSchema;

export const fullNameSchema = z.string().trim().min(1).max(100);

export const userRoleSchema = z.enum(["ADMIN", "BANK_ADMIN", "ACCOUNT"]);

export const accountSchema = z.object({
  userId: z.string().min(1),
  accountNo: accountEmailSchema,
  type: z.enum(["CHECKING", "SAVINGS", "LOAN", "PLEDGE"]),
});

export const accountUserCreateSchema = z.object({
  username: usernameSchema,
  fullName: fullNameSchema,
  role: userRoleSchema.default("ACCOUNT"),
  bankId: z.string().min(1).nullable().optional(),
  password: z.string().min(4).max(72).optional(),
  isActive: z.boolean().default(true),
});

export const accountUserUpdateSchema = z.object({
  username: usernameSchema.optional(),
  fullName: fullNameSchema.optional(),
  role: userRoleSchema.optional(),
  bankId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  resetPasswordRequested: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  mode: z.enum(["random", "custom"]),
  password: z.string().min(4).max(72).optional(),
}).superRefine((value, context) => {
  if (value.mode === "custom" && !value.password) {
    context.addIssue({
      code: "custom",
      message: "Password is required.",
      path: ["password"],
    });
  }
});

export const bankCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/),
  isActive: z.boolean().default(true),
});

export const bankUpdateSchema = bankCreateSchema.partial();

export const loanSchema = z.object({
  userId: z.string().min(1),
  accountId: z.string().min(1),
  principal: moneyAmountSchema,
  interestRate: z.coerce.number().min(0),
  termMonths: z.coerce.number().int().positive(),
});

export const loanBaseRateSchema = z.object({
  annualRatePercent: z.coerce.number().min(0).lt(50),
});

export const loanInterestPolicyTypeSchema = z.enum(["BASIC", "TERM"]);

const loanInterestPolicyBaseSchema = z.object({
  bankId: z.string().min(1).optional(),
  type: loanInterestPolicyTypeSchema,
  annualRatePercent: z.coerce.number().min(0).lt(50).nullable().optional(),
  termMonths: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const loanInterestPolicySchema = loanInterestPolicyBaseSchema
  .superRefine((value, context) => {
    if (value.type === "TERM" && !value.termMonths) {
      context.addIssue({
        code: "custom",
        message: "Term months is required.",
        path: ["termMonths"],
      });
    }
  });

export const loanInterestPolicyUpdateSchema = loanInterestPolicyBaseSchema
  .partial()
  .superRefine((value, context) => {
    if (value.type === "TERM" && !value.termMonths) {
      context.addIssue({
        code: "custom",
        message: "Term months is required.",
        path: ["termMonths"],
      });
    }
  });

export const loanCreateSchema = z.object({
  recipientAccountNo: accountEmailSchema,
  amount: transferAmountSchema,
  termMonths: z.coerce.number().int().positive(),
  note: z.string().trim().max(200).optional(),
});

export const loanRepaymentSchema = z.object({
  amount: transferAmountSchema,
});

export const loanRateChangeSchema = z.object({
  annualRatePercent: z.coerce.number().min(0).lt(50),
  effectiveDate: z.string().optional(),
});

export const fundTransactionSchema = z.object({
  amount: transferAmountSchema,
  reason: z.string().trim().min(1).max(200),
  bankId: z.string().min(1).optional(),
});

export const transferSchema = z.object({
  recipientAccountNo: accountEmailSchema,
  amount: transferAmountSchema,
});

export const depositSchema = z.object({
  recipientAccountNo: accountEmailSchema,
  amount: transferAmountSchema,
});

export const expenseSchema = z.object({
  purpose: z.string().trim().min(1).max(200),
  withdrawalCategory: z.string().trim().min(1).max(100),
  amount: transferAmountSchema,
});

export const savingInterestPolicyTypeSchema = z.enum([
  "BASIC",
  "PERIOD",
  "PROMOTIONAL",
]);

export const savingBaseRateSchema = z.object({
  annualRatePercent: z.coerce.number().min(0).lt(50),
});

const savingInterestPolicyBaseSchema = z.object({
  bankId: z.string().min(1).optional(),
  type: savingInterestPolicyTypeSchema,
  annualRatePercent: z.coerce.number().min(0).lt(50).nullable().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const savingInterestPolicySchema = savingInterestPolicyBaseSchema
  .superRefine((value, context) => {
    if (value.type !== "PERIOD") {
      return;
    }

    if (!value.startDate) {
      context.addIssue({
        code: "custom",
        message: "Start date is required.",
        path: ["startDate"],
      });
    }

    if (!value.endDate) {
      context.addIssue({
        code: "custom",
        message: "End date is required.",
        path: ["endDate"],
      });
    }

    if (
      value.startDate &&
      value.endDate &&
      new Date(value.startDate) > new Date(value.endDate)
    ) {
      context.addIssue({
        code: "custom",
        message: "End date must be after start date.",
        path: ["endDate"],
      });
    }
  });

export const savingInterestPolicyUpdateSchema = savingInterestPolicyBaseSchema
  .partial()
  .superRefine((value, context) => {
    if (value.type !== "PERIOD") {
      return;
    }

    if (!value.startDate) {
      context.addIssue({
        code: "custom",
        message: "Start date is required.",
        path: ["startDate"],
      });
    }

    if (!value.endDate) {
      context.addIssue({
        code: "custom",
        message: "End date is required.",
        path: ["endDate"],
      });
    }

    if (
      value.startDate &&
      value.endDate &&
      new Date(value.startDate) > new Date(value.endDate)
    ) {
      context.addIssue({
        code: "custom",
        message: "End date must be after start date.",
        path: ["endDate"],
      });
    }
  });

export const savingCreateSchema = z.object({
  amount: transferAmountSchema,
  termMonths: z.coerce.number().int().refine((value) =>
    [1, 2, 3, 6, 12].includes(value),
  ),
});

export const savingWithdrawalSchema = z.object({
  type: z.enum(["PARTIAL", "FULL"]),
  amount: transferAmountSchema.optional(),
}).superRefine((value, context) => {
  if (value.type === "PARTIAL" && !value.amount) {
    context.addIssue({
      code: "custom",
      message: "Withdrawal amount is required.",
      path: ["amount"],
    });
  }
});

export const stockSymbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,10}$/);

export const stockWatchlistCreateSchema = z.object({
  symbol: stockSymbolSchema,
});

export const stockWatchlistUpdateSchema = z.object({
  symbol: stockSymbolSchema,
});

export const stockCrawlerSettingSchema = z.object({
  urlTemplate: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => value.includes("{symbol}"), {
      message: "URL template must include {symbol}.",
    }),
  timeoutMs: z.coerce.number().int().min(5000).max(30000),
  waitAfterLoadMs: z.coerce.number().int().min(1000).max(10000),
  maxRawLogs: z.coerce.number().int().min(1).max(50),
});

export const stockTradeSchema = z.object({
  symbol: stockSymbolSchema,
  type: z.enum(["BUY", "SELL"]),
  quantity: z.coerce
    .number()
    .int()
    .positive()
    .refine((value) => value % 100 === 0, {
      message: "Quantity must be a multiple of 100.",
    }),
});
