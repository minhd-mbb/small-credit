import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import {
  getMaxLoanBankBaseRate,
  getMaxLoanTermRate,
  getMinLoanBankBaseRate,
  getMinLoanTermRate,
  roundLoanRate,
  SYSTEM_LOAN_BASE_RATE_ID,
} from "@/lib/loan-policy";
import { prisma } from "@/lib/prisma";
import { loanBaseRateSchema } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession();

  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [baseRate, bankCount] = await Promise.all([
    prisma.systemLoanBaseRate.findUnique({
      where: { id: SYSTEM_LOAN_BASE_RATE_ID },
    }),
    prisma.bank.count(),
  ]);

  return NextResponse.json({
    data: {
      annualRatePercent: baseRate?.annualRatePercent.toString() ?? "",
      updatedAt: baseRate?.updatedAt.toISOString() ?? null,
      updatedBy: baseRate?.updatedBy ?? null,
      synchronizedBanks: bankCount,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();

  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = loanBaseRateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid loan base rate" }, { status: 400 });
  }

  const before = await prisma.systemLoanBaseRate.findUnique({
    where: { id: SYSTEM_LOAN_BASE_RATE_ID },
  });
  const previousSystemRate =
    before === null ? null : Number(before.annualRatePercent.toString());
  const nextSystemRate = payload.data.annualRatePercent;

  const result = await prisma.$transaction(async (tx) => {
    const banks = await tx.bank.findMany({ select: { id: true } });
    const existingPolicies = await tx.loanInterestPolicy.findMany();
    const basicPoliciesByBank = new Map(
      existingPolicies
        .filter((policy) => policy.type === "BASIC")
        .map((policy) => [policy.bankId, policy]),
    );

    const baseRate = await tx.systemLoanBaseRate.upsert({
      where: { id: SYSTEM_LOAN_BASE_RATE_ID },
      update: {
        annualRatePercent: nextSystemRate,
        updatedBy: session.user.username,
      },
      create: {
        id: SYSTEM_LOAN_BASE_RATE_ID,
        annualRatePercent: nextSystemRate,
        updatedBy: session.user.username,
      },
    });

    const adjustedPolicies = [];

    for (const bank of banks) {
      const basicPolicy = basicPoliciesByBank.get(bank.id);
      const previousBankBaseRate = basicPolicy
        ? Number(basicPolicy.annualRatePercent.toString())
        : previousSystemRate ?? nextSystemRate;
      const bankBaseRatio =
        previousSystemRate && previousSystemRate > 0
          ? previousBankBaseRate / previousSystemRate
          : 1;
      const nextBankBaseRate = roundLoanRate(
        clamp(
          nextSystemRate * bankBaseRatio,
          getMinLoanBankBaseRate(nextSystemRate),
          getMaxLoanBankBaseRate(nextSystemRate),
        ),
      );

      if (basicPolicy) {
        await tx.loanInterestPolicy.update({
          where: { id: basicPolicy.id },
          data: {
            annualRatePercent: nextBankBaseRate,
            termMonths: null,
            isActive: true,
          },
        });
      } else {
        await tx.loanInterestPolicy.create({
          data: {
            bankId: bank.id,
            type: "BASIC",
            annualRatePercent: nextBankBaseRate,
            termMonths: null,
            isActive: true,
          },
        });
      }

      const termPolicies = existingPolicies.filter(
        (policy) => policy.bankId === bank.id && policy.type === "TERM",
      );

      for (const policy of termPolicies) {
        const previousPolicyRate = Number(policy.annualRatePercent.toString());
        const policyRatio =
          previousBankBaseRate > 0 ? previousPolicyRate / previousBankBaseRate : 1;
        const nextPolicyRate = roundLoanRate(
          clamp(
            nextBankBaseRate * policyRatio,
            getMinLoanTermRate(nextBankBaseRate),
            getMaxLoanTermRate(nextBankBaseRate),
          ),
        );

        await tx.loanInterestPolicy.update({
          where: { id: policy.id },
          data: { annualRatePercent: nextPolicyRate },
        });

        adjustedPolicies.push({
          bankId: bank.id,
          policyId: policy.id,
          termMonths: policy.termMonths,
          previousRate: previousPolicyRate,
          nextRate: nextPolicyRate,
        });
      }
    }

    return { baseRate, synchronizedBanks: banks.length, adjustedPolicies };
  });

  await logActivity({
    username: session.user.username,
    action: "UPDATE_SYSTEM_LOAN_BASE_RATE",
    functionName: "Loan management",
    beforeChange: {
      annualRatePercent: before?.annualRatePercent.toString() ?? null,
    },
    afterChange: {
      annualRatePercent: result.baseRate.annualRatePercent.toString(),
      synchronizedBanks: result.synchronizedBanks,
      adjustedPolicies: result.adjustedPolicies,
    },
  });

  return NextResponse.json({
    data: {
      annualRatePercent: result.baseRate.annualRatePercent.toString(),
      updatedAt: result.baseRate.updatedAt.toISOString(),
      updatedBy: result.baseRate.updatedBy,
      synchronizedBanks: result.synchronizedBanks,
    },
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
