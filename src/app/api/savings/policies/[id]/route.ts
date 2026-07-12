import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import {
  isBankPolicyRateAllowed,
  isBankBasicRateAllowed,
  normalizeOptionalBankPolicyRate,
  SYSTEM_SAVING_BASE_RATE_ID,
} from "@/lib/savings-policy";
import { savingInterestPolicyUpdateSchema } from "@/lib/validations";

function canManageSavings(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

function normalizePolicyDates(type?: string, startDate?: string | null, endDate?: string | null) {
  if (type && type !== "PERIOD") {
    return {
      startDate: null,
      endDate: null,
    };
  }

  return {
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();

  if (!canManageSavings(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const current = await prisma.savingInterestPolicy.findUnique({
    where: { id },
    include: { bank: true },
  });

  if (!current) {
    return NextResponse.json({ error: "Policy not found." }, { status: 404 });
  }

  if (session?.user.role === "BANK_ADMIN" && current.bankId !== session.user.bankId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = savingInterestPolicyUpdateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid saving policy data" }, { status: 400 });
  }

  const nextType = payload.data.type ?? current.type;

  if (current.type === "BASIC" && session?.user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Use system basic saving rate management." },
      { status: 400 },
    );
  }

  if (current.type === "BASIC" && nextType !== "BASIC") {
    return NextResponse.json(
      { error: "Basic saving rate type cannot be changed." },
      { status: 400 },
    );
  }

  if (nextType === "BASIC") {
    const systemBaseRateNumber = await getSystemBaseRateNumber();

    if (systemBaseRateNumber === null) {
      return NextResponse.json(
        { error: "System basic saving rate is not configured." },
        { status: 400 },
      );
    }

    const nextRate =
      payload.data.annualRatePercent === null
        ? systemBaseRateNumber
        : payload.data.annualRatePercent ??
      Number(current.annualRatePercent.toString());

    if (!isBankBasicRateAllowed(nextRate, systemBaseRateNumber)) {
      return NextResponse.json(
        {
          error:
            "Bank basic saving rate must be from the admin base rate up to 20% higher.",
        },
        { status: 400 },
      );
    }
  }

  const bankId =
    session?.user.role === "BANK_ADMIN"
      ? current.bankId
      : payload.data.bankId ?? current.bankId;
  const dates = normalizePolicyDates(
    nextType,
    payload.data.startDate,
    payload.data.endDate,
  );
  let annualRatePercent = payload.data.annualRatePercent;

  if (nextType !== "BASIC") {
    const bankBaseRate = await getBankBaseRateNumber(bankId);

    if (bankBaseRate === null) {
      return NextResponse.json(
        { error: "Bank basic saving rate is not configured." },
        { status: 400 },
      );
    }

    if (annualRatePercent === null) {
      annualRatePercent = normalizeOptionalBankPolicyRate(undefined, bankBaseRate);
    } else if (annualRatePercent !== undefined) {
      annualRatePercent = normalizeOptionalBankPolicyRate(
        annualRatePercent,
        bankBaseRate,
      );
    }

    const nextRate =
      annualRatePercent === undefined
        ? Number(current.annualRatePercent.toString())
        : annualRatePercent;

    if (!isBankPolicyRateAllowed(nextRate, bankBaseRate)) {
      return NextResponse.json(
        {
          error:
            "Saving rate must not be lower than the bank basic saving rate.",
        },
        { status: 400 },
      );
    }
  } else if (annualRatePercent === null) {
    const systemBaseRateNumber = await getSystemBaseRateNumber();
    annualRatePercent = systemBaseRateNumber ?? undefined;
  }

  const updated = await prisma.savingInterestPolicy.update({
    where: { id },
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
    action: "UPDATE_SAVING_INTEREST_POLICY",
    functionName: "Savings management",
    beforeChange: {
      id: current.id,
      bankId: current.bankId,
      type: current.type,
      annualRatePercent: current.annualRatePercent.toString(),
      startDate: current.startDate?.toISOString() ?? null,
      endDate: current.endDate?.toISOString() ?? null,
      isActive: current.isActive,
    },
    afterChange: {
      id: updated.id,
      bankId: updated.bankId,
      type: updated.type,
      annualRatePercent: updated.annualRatePercent.toString(),
      startDate: updated.startDate?.toISOString() ?? null,
      endDate: updated.endDate?.toISOString() ?? null,
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
      startDate: updated.startDate?.toISOString() ?? null,
      endDate: updated.endDate?.toISOString() ?? null,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();

  if (!canManageSavings(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const current = await prisma.savingInterestPolicy.findUnique({
    where: { id },
  });

  if (!current) {
    return NextResponse.json({ error: "Policy not found." }, { status: 404 });
  }

  if (current.type === "BASIC") {
    return NextResponse.json(
      { error: "Basic saving rate cannot be deleted." },
      { status: 400 },
    );
  }

  if (session?.user.role === "BANK_ADMIN" && current.bankId !== session.user.bankId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.savingInterestPolicy.delete({ where: { id } });

  await logActivity({
    username: session.user.username,
    action: "DELETE_SAVING_INTEREST_POLICY",
    functionName: "Savings management",
    beforeChange: {
      id: current.id,
      bankId: current.bankId,
      type: current.type,
      annualRatePercent: current.annualRatePercent.toString(),
      startDate: current.startDate?.toISOString() ?? null,
      endDate: current.endDate?.toISOString() ?? null,
      isActive: current.isActive,
    },
    afterChange: null,
  });

  return NextResponse.json({ ok: true });
}
