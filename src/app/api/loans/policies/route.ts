import { NextResponse } from "next/server";
import type { Bank } from "@prisma/client";
import { logActivity } from "@/lib/activity-log";
import { auth } from "@/lib/auth";
import {
  normalizeLoanBankBaseRate,
  normalizeLoanTermRate,
} from "@/lib/loans-service";
import { prisma } from "@/lib/prisma";
import { loanInterestPolicySchema } from "@/lib/validations";

function canManageLoans(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

export async function GET() {
  const session = await auth();

  if (!canManageLoans(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where =
    session?.user.role === "BANK_ADMIN"
      ? { bankId: session.user.bankId ?? "__missing_bank__" }
      : {};

  const [policies, banks, systemBaseRate] = await Promise.all([
    prisma.loanInterestPolicy.findMany({
      where,
      include: { bank: true },
      orderBy: [{ type: "asc" }, { termMonths: "asc" }, { createdAt: "desc" }],
    }),
    session?.user.role === "ADMIN"
      ? prisma.bank.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve<Bank[]>([]),
    prisma.systemLoanBaseRate.findFirst(),
  ]);

  return NextResponse.json({
    data: policies.map((policy) => ({
      id: policy.id,
      bankId: policy.bankId,
      bankName: policy.bank.name,
      type: policy.type,
      annualRatePercent: policy.annualRatePercent.toString(),
      termMonths: policy.termMonths,
      isActive: policy.isActive,
      createdAt: policy.createdAt.toISOString(),
    })),
    banks,
    systemBaseRate: systemBaseRate?.annualRatePercent.toString() ?? null,
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!canManageLoans(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = loanInterestPolicySchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid loan policy data" }, { status: 400 });
  }

  const bankId =
    session?.user.role === "BANK_ADMIN" ? session.user.bankId : payload.data.bankId;

  if (!bankId) {
    return NextResponse.json({ error: "Bank is required." }, { status: 400 });
  }

  if (payload.data.type === "BASIC" && session?.user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Use system loan base rate management." },
      { status: 400 },
    );
  }

  const annualRatePercent =
    payload.data.type === "BASIC"
      ? await normalizeLoanBankBaseRate(payload.data.annualRatePercent ?? undefined)
      : await normalizeLoanTermRate({
          bankId,
          requestedRate: payload.data.annualRatePercent ?? undefined,
        });

  const existing =
    payload.data.type === "BASIC"
      ? await prisma.loanInterestPolicy.findFirst({
          where: { bankId, type: "BASIC" },
          include: { bank: true },
        })
      : await prisma.loanInterestPolicy.findFirst({
          where: {
            bankId,
            type: "TERM",
            termMonths: payload.data.termMonths ?? undefined,
          },
          include: { bank: true },
        });

  const policy = existing
    ? await prisma.loanInterestPolicy.update({
        where: { id: existing.id },
        data: {
          annualRatePercent,
          termMonths: payload.data.type === "TERM" ? payload.data.termMonths : null,
          isActive: payload.data.isActive,
        },
        include: { bank: true },
      })
    : await prisma.loanInterestPolicy.create({
        data: {
          bankId,
          type: payload.data.type,
          annualRatePercent,
          termMonths: payload.data.type === "TERM" ? payload.data.termMonths : null,
          isActive: payload.data.isActive,
        },
        include: { bank: true },
      });

  await logActivity({
    username: session.user.username,
    action: existing ? "UPDATE_LOAN_INTEREST_POLICY" : "CREATE_LOAN_INTEREST_POLICY",
    functionName: "Loan management",
    beforeChange: existing
      ? {
          id: existing.id,
          bankId: existing.bankId,
          type: existing.type,
          termMonths: existing.termMonths,
          annualRatePercent: existing.annualRatePercent.toString(),
          isActive: existing.isActive,
        }
      : null,
    afterChange: {
      id: policy.id,
      bankId: policy.bankId,
      type: policy.type,
      termMonths: policy.termMonths,
      annualRatePercent: policy.annualRatePercent.toString(),
      isActive: policy.isActive,
    },
  });

  return NextResponse.json({
    data: {
      id: policy.id,
      bankId: policy.bankId,
      bankName: policy.bank.name,
      type: policy.type,
      termMonths: policy.termMonths,
      annualRatePercent: policy.annualRatePercent.toString(),
      isActive: policy.isActive,
      createdAt: policy.createdAt.toISOString(),
    },
  });
}
