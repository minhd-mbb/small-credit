import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import {
  getMaxBankBasicRate,
  getMaxBankPolicyRate,
  isBankBasicRateAllowed,
  isBankPolicyRateAllowed,
  normalizeOptionalBankPolicyRate,
  SYSTEM_SAVING_BASE_RATE_ID,
} from "@/lib/savings-policy";
import { savingInterestPolicySchema } from "@/lib/validations";

type BankRecord = Awaited<ReturnType<typeof prisma.bank.findMany>>[number];

function canManageSavings(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

function normalizePolicyDates(type: string, startDate?: string | null, endDate?: string | null) {
  if (type !== "PERIOD") {
    return {
      startDate: null,
      endDate: null,
    };
  }

  return {
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
  };
}

async function getSystemBaseRateNumber() {
  const systemBaseRate = await prisma.systemSavingBaseRate.findUnique({
    where: { id: SYSTEM_SAVING_BASE_RATE_ID },
  });

  return systemBaseRate ? Number(systemBaseRate.annualRatePercent.toString()) : null;
}

async function getBankBaseRateNumber(bankId: string) {
  const bankBasicRate = await prisma.savingInterestPolicy.findFirst({
    where: {
      bankId,
      type: "BASIC",
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (bankBasicRate) {
    return Number(bankBasicRate.annualRatePercent.toString());
  }

  return getSystemBaseRateNumber();
}

function resolvePolicyRate({
  bankBaseRate,
  requestedRate,
  type,
}: {
  bankBaseRate: number;
  requestedRate?: number;
  type: string;
}) {
  if (type === "BASIC") {
    return requestedRate ?? bankBaseRate;
  }

  const normalizedRate = normalizeOptionalBankPolicyRate(
    requestedRate,
    bankBaseRate,
  );

  if (!isBankPolicyRateAllowed(normalizedRate, bankBaseRate)) {
    throw new Error("POLICY_RATE_BELOW_BANK_BASE");
  }

  return normalizedRate;
}

export async function GET() {
  const session = await getServerSession();

  if (!canManageSavings(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where =
    session?.user.role === "BANK_ADMIN"
      ? { bankId: session.user.bankId ?? "__missing_bank__" }
      : {};

  const [policies, banks, systemBaseRate] = await Promise.all([
    prisma.savingInterestPolicy.findMany({
      where,
      include: { bank: true },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    }),
    session?.user.role === "ADMIN"
      ? prisma.bank.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve<BankRecord[]>([]),
    prisma.systemSavingBaseRate.findUnique({
      where: { id: SYSTEM_SAVING_BASE_RATE_ID },
    }),
  ]);
  const systemBaseRateNumber = systemBaseRate
    ? Number(systemBaseRate.annualRatePercent.toString())
    : null;

  return NextResponse.json({
    data: policies.map((policy) => ({
      id: policy.id,
      bankId: policy.bankId,
      bankName: policy.bank.name,
      type: policy.type,
      annualRatePercent: policy.annualRatePercent.toString(),
      startDate: policy.startDate?.toISOString() ?? null,
      endDate: policy.endDate?.toISOString() ?? null,
      isActive: policy.isActive,
      createdAt: policy.createdAt.toISOString(),
    })),
    systemBaseRate: systemBaseRate?.annualRatePercent.toString() ?? null,
    maxBankBasicRate:
      systemBaseRateNumber === null
        ? null
        : getMaxBankBasicRate(systemBaseRateNumber).toFixed(2),
    maxBankPolicyRateByBank: Object.fromEntries(
      policies.map((policy) => {
        const bankBasicPolicy = policies.find(
          (candidate) =>
            candidate.bankId === policy.bankId && candidate.type === "BASIC",
        );
        const bankBaseRate = bankBasicPolicy
          ? Number(bankBasicPolicy.annualRatePercent.toString())
          : systemBaseRateNumber;

        return [
          policy.bankId,
          bankBaseRate === null
            ? null
            : getMaxBankPolicyRate(bankBaseRate).toFixed(2),
        ];
      }),
    ),
    banks,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!canManageSavings(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = savingInterestPolicySchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid saving policy data" }, { status: 400 });
  }

  const bankId =
    session?.user.role === "BANK_ADMIN"
      ? session.user.bankId
      : payload.data.bankId;

  if (!bankId) {
    return NextResponse.json({ error: "Bank is required." }, { status: 400 });
  }

  if (payload.data.type === "BASIC") {
    if (session?.user.role === "ADMIN") {
      return NextResponse.json(
        { error: "Use system basic saving rate management." },
        { status: 400 },
      );
    }

    const systemBaseRateNumber = await getSystemBaseRateNumber();

    if (systemBaseRateNumber === null) {
      return NextResponse.json(
        { error: "System basic saving rate is not configured." },
        { status: 400 },
      );
    }

    const nextBasicRate =
      payload.data.annualRatePercent ?? systemBaseRateNumber;

    if (!isBankBasicRateAllowed(nextBasicRate, systemBaseRateNumber)) {
      return NextResponse.json(
        {
          error:
            "Bank basic saving rate must be from the admin base rate up to 20% higher.",
        },
        { status: 400 },
      );
    }

    const existingBasicPolicy = await prisma.savingInterestPolicy.findFirst({
      where: { bankId, type: "BASIC" },
      include: { bank: true },
      orderBy: { createdAt: "asc" },
    });

    if (existingBasicPolicy) {
      const updated = await prisma.savingInterestPolicy.update({
        where: { id: existingBasicPolicy.id },
        data: {
          annualRatePercent: nextBasicRate,
          startDate: null,
          endDate: null,
          isActive: payload.data.isActive,
        },
        include: { bank: true },
      });

      await logActivity({
        username: session.user.username,
        action: "UPDATE_SAVING_INTEREST_POLICY",
        functionName: "Savings management",
        beforeChange: {
          id: existingBasicPolicy.id,
          bankId: existingBasicPolicy.bankId,
          type: existingBasicPolicy.type,
          annualRatePercent: existingBasicPolicy.annualRatePercent.toString(),
          isActive: existingBasicPolicy.isActive,
        },
        afterChange: {
          id: updated.id,
          bankId: updated.bankId,
          type: updated.type,
          annualRatePercent: updated.annualRatePercent.toString(),
          isActive: updated.isActive,
        },
      });

      return NextResponse.json({
        data: {
          id: updated.id,
          bankId: updated.bankId,
          bankName: updated.bank.name,
          type: updated.type,
          annualRatePercent: updated.annualRatePercent.toString(),
          startDate: null,
          endDate: null,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    }
  }

  const bankBaseRateNumber = await getBankBaseRateNumber(bankId);

  if (bankBaseRateNumber === null) {
    return NextResponse.json(
      { error: "Bank basic saving rate is not configured." },
      { status: 400 },
    );
  }

  let annualRatePercent: number;

  try {
    annualRatePercent = resolvePolicyRate({
      bankBaseRate: bankBaseRateNumber,
      requestedRate: payload.data.annualRatePercent ?? undefined,
      type: payload.data.type,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "POLICY_RATE_BELOW_BANK_BASE"
    ) {
      return NextResponse.json(
        {
          error:
            "Saving rate must not be lower than the bank basic saving rate.",
        },
        { status: 400 },
      );
    }

    throw error;
  }

  const dates = normalizePolicyDates(
    payload.data.type,
    payload.data.startDate,
    payload.data.endDate,
  );

  const policy = await prisma.savingInterestPolicy.create({
    data: {
      bankId,
      type: payload.data.type,
      annualRatePercent,
      startDate: dates.startDate,
      endDate: dates.endDate,
      isActive: payload.data.isActive,
    },
    include: { bank: true },
  });

  await logActivity({
    username: session.user.username,
    action: "CREATE_SAVING_INTEREST_POLICY",
    functionName: "Savings management",
    beforeChange: null,
    afterChange: {
      id: policy.id,
      bankId: policy.bankId,
      type: policy.type,
      annualRatePercent: policy.annualRatePercent.toString(),
      startDate: policy.startDate?.toISOString() ?? null,
      endDate: policy.endDate?.toISOString() ?? null,
      isActive: policy.isActive,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: policy.id,
        bankId: policy.bankId,
        bankName: policy.bank.name,
        type: policy.type,
        annualRatePercent: policy.annualRatePercent.toString(),
        startDate: policy.startDate?.toISOString() ?? null,
        endDate: policy.endDate?.toISOString() ?? null,
        isActive: policy.isActive,
        createdAt: policy.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
