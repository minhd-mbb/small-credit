import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import {
  getMaxBankBasicRate,
  getMaxBankPolicyRate,
  SYSTEM_SAVING_BASE_RATE_ID,
} from "@/lib/savings-policy";
import { savingBaseRateSchema } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession();

  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [baseRate, bankCount] = await Promise.all([
    prisma.systemSavingBaseRate.findUnique({
      where: { id: SYSTEM_SAVING_BASE_RATE_ID },
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

  const payload = savingBaseRateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid saving base rate" }, { status: 400 });
  }

  const before = await prisma.systemSavingBaseRate.findUnique({
    where: { id: SYSTEM_SAVING_BASE_RATE_ID },
  });
  const previousSystemRate =
    before === null ? null : Number(before.annualRatePercent.toString());
  const nextSystemRate = payload.data.annualRatePercent;

  const result = await prisma.$transaction(async (tx) => {
    const banks = await tx.bank.findMany({ select: { id: true } });
    const existingPolicies = await tx.savingInterestPolicy.findMany();
    const basicPoliciesByBank = new Map(
      existingPolicies
        .filter((policy) => policy.type === "BASIC")
        .map((policy) => [policy.bankId, policy]),
    );

    const baseRate = await tx.systemSavingBaseRate.upsert({
      where: { id: SYSTEM_SAVING_BASE_RATE_ID },
      update: {
        annualRatePercent: nextSystemRate,
        updatedBy: session.user.username,
      },
      create: {
        id: SYSTEM_SAVING_BASE_RATE_ID,
        annualRatePercent: nextSystemRate,
        updatedBy: session.user.username,
      },
    });

    const rateChanges = [];

    for (const bank of banks) {
      const basicPolicy = basicPoliciesByBank.get(bank.id);
      const previousBankBaseRate = basicPolicy
        ? Number(basicPolicy.annualRatePercent.toString())
        : previousSystemRate ?? nextSystemRate;
      const bankBaseRatio =
        previousSystemRate && previousSystemRate > 0
          ? previousBankBaseRate / previousSystemRate
          : 1;
      const nextBankBaseRate = roundRate(
        clamp(
          nextSystemRate * bankBaseRatio,
          nextSystemRate,
          getMaxBankBasicRate(nextSystemRate),
        ),
      );

      if (basicPolicy) {
        await tx.savingInterestPolicy.update({
          where: { id: basicPolicy.id },
          data: {
            annualRatePercent: nextBankBaseRate,
            startDate: null,
            endDate: null,
            isActive: true,
          },
        });
      } else {
        await tx.savingInterestPolicy.create({
          data: {
            bankId: bank.id,
            type: "BASIC",
            annualRatePercent: nextBankBaseRate,
            startDate: null,
            endDate: null,
            isActive: true,
          },
        });
      }

      const bankVariablePolicies = existingPolicies.filter(
        (policy) =>
          policy.bankId === bank.id &&
          (policy.type === "PERIOD" || policy.type === "PROMOTIONAL"),
      );

      for (const policy of bankVariablePolicies) {
        const previousPolicyRate = Number(policy.annualRatePercent.toString());
        const policyRatio =
          previousBankBaseRate > 0
            ? previousPolicyRate / previousBankBaseRate
            : 1;
        const nextPolicyRate = roundRate(
          clamp(
            nextBankBaseRate * policyRatio,
            nextBankBaseRate,
            getMaxBankPolicyRate(nextBankBaseRate),
          ),
        );

        await tx.savingInterestPolicy.update({
          where: { id: policy.id },
          data: { annualRatePercent: nextPolicyRate },
        });

        rateChanges.push({
          bankId: bank.id,
          policyId: policy.id,
          type: policy.type,
          previousRate: previousPolicyRate,
          nextRate: nextPolicyRate,
        });
      }
    }

    return {
      baseRate,
      synchronizedBanks: banks.length,
      rateChanges,
    };
  });

  await logActivity({
    username: session.user.username,
    action: "UPDATE_SYSTEM_SAVING_BASE_RATE",
    functionName: "Savings management",
    beforeChange: {
      annualRatePercent: before?.annualRatePercent.toString() ?? null,
    },
    afterChange: {
      annualRatePercent: result.baseRate.annualRatePercent.toString(),
      synchronizedBanks: result.synchronizedBanks,
      adjustedPolicies: result.rateChanges,
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

        const session = await getServerSession();
  return Math.min(Math.max(value, min), max);
}

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
}
