import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import {
  normalizeLoanBankBaseRate,
  normalizeLoanTermRate,
} from "@/lib/loans-service";
import { prisma } from "@/lib/prisma";
import { loanInterestPolicyUpdateSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function canManageLoans(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!canManageLoans(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.loanInterestPolicy.findUnique({
    where: { id },
    include: { bank: true },
  });

  if (!current) {
    return NextResponse.json({ error: "Policy not found." }, { status: 404 });
  }

  if (session?.user.role === "BANK_ADMIN" && current.bankId !== session.user.bankId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (current.type === "BASIC" && session?.user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Use system loan base rate management." },
      { status: 400 },
    );
  }

  const payload = loanInterestPolicyUpdateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid loan policy data" }, { status: 400 });
  }

  const nextType = payload.data.type ?? current.type;

  if (current.type === "BASIC" && nextType !== "BASIC") {
    return NextResponse.json(
      { error: "Basic loan rate type cannot be changed." },
      { status: 400 },
    );
  }

  const bankId =
    session?.user.role === "BANK_ADMIN"
      ? current.bankId
      : payload.data.bankId ?? current.bankId;
  const annualRatePercent =
    nextType === "BASIC"
      ? await normalizeLoanBankBaseRate(
          payload.data.annualRatePercent === null
            ? undefined
            : payload.data.annualRatePercent ?? Number(current.annualRatePercent.toString()),
        )
      : await normalizeLoanTermRate({
          bankId,
          requestedRate:
            payload.data.annualRatePercent === null
              ? undefined
              : payload.data.annualRatePercent ?? Number(current.annualRatePercent.toString()),
        });

  const updated = await prisma.loanInterestPolicy.update({
    where: { id },
    data: {
      bankId,
      type: payload.data.type,
      termMonths:
        nextType === "TERM"
          ? payload.data.termMonths ?? current.termMonths
          : null,
      annualRatePercent,
      isActive: payload.data.isActive,
    },
    include: { bank: true },
  });

  await logActivity({
    username: session.user.username,
    action: "UPDATE_LOAN_INTEREST_POLICY",
    functionName: "Loan management",
    beforeChange: {
      id: current.id,
      bankId: current.bankId,
      type: current.type,
      termMonths: current.termMonths,
      annualRatePercent: current.annualRatePercent.toString(),
      isActive: current.isActive,
    },
    afterChange: {
      id: updated.id,
      bankId: updated.bankId,
      type: updated.type,
      termMonths: updated.termMonths,
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
      termMonths: updated.termMonths,
      annualRatePercent: updated.annualRatePercent.toString(),
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!canManageLoans(session?.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.loanInterestPolicy.findUnique({ where: { id } });

  if (!current) {
    return NextResponse.json({ error: "Policy not found." }, { status: 404 });
  }

  if (current.type === "BASIC") {
    return NextResponse.json(
      { error: "Basic loan rate cannot be deleted." },
      { status: 400 },
    );
  }

  if (session?.user.role === "BANK_ADMIN" && current.bankId !== session.user.bankId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.loanInterestPolicy.delete({ where: { id } });

  await logActivity({
    username: session.user.username,
    action: "DELETE_LOAN_INTEREST_POLICY",
    functionName: "Loan management",
    beforeChange: {
      id: current.id,
      bankId: current.bankId,
      type: current.type,
      termMonths: current.termMonths,
      annualRatePercent: current.annualRatePercent.toString(),
      isActive: current.isActive,
    },
    afterChange: null,
  });

  return NextResponse.json({ ok: true });
}
