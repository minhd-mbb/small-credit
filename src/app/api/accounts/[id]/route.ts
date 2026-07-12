import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { accountUserUpdateSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function canManageAccounts(role?: string) {
  return role === "ADMIN" || role === "BANK_ADMIN";
}

async function getManageableUser(
  id: string,
  session: { user: { role: string; bankId?: string | null; id?: string } } | null,
) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    return null;
  }

  if (session.user.role === "ADMIN") {
    return user;
  }

  if (
    session.user.role === "BANK_ADMIN" &&
    user.bankId === session.user.bankId &&
    user.role === "ACCOUNT"
  ) {
    return user;
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session || !canManageAccounts(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const currentUser = await getManageableUser(id, session);

  if (!currentUser) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const payload = accountUserUpdateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid account data" }, { status: 400 });
  }

  const role =
    session.user.role === "BANK_ADMIN"
      ? "ACCOUNT"
      : payload.data.role ?? currentUser.role;
  const bankId =
    session.user.role === "BANK_ADMIN"
      ? session.user.bankId
      : payload.data.bankId === undefined
        ? currentUser.bankId
        : payload.data.bankId;

  if (role !== "ADMIN" && !bankId) {
    return NextResponse.json(
      { error: "Bank is required for this account." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          username: payload.data.username,
          fullName: payload.data.fullName,
          role,
          bankId,
          isActive: payload.data.isActive,
          resetPasswordRequested: payload.data.resetPasswordRequested,
        },
        include: { bank: true },
      });

      if (payload.data.username || bankId !== currentUser.bankId) {
        await tx.account.updateMany({
          where: { userId: id },
          data: {
            accountNo: payload.data.username,
            bankId,
          },
        });
      }

      return user;
    });

    await logActivity({
      username: session.user.username,
      action: "UPDATE_ACCOUNT",
      functionName: "Account management",
      beforeChange: {
        targetUsername: currentUser.username,
        fullName: currentUser.fullName,
        role: currentUser.role,
        bankId: currentUser.bankId,
        isActive: currentUser.isActive,
        resetPasswordRequested: currentUser.resetPasswordRequested,
      },
      afterChange: {
        targetUsername: updated.username,
        fullName: updated.fullName,
        role: updated.role,
        bankId: updated.bankId,
        isActive: updated.isActive,
        resetPasswordRequested: updated.resetPasswordRequested,
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
        role: updated.role,
        bankId: updated.bankId,
        bankName: updated.bank?.name ?? null,
        isActive: updated.isActive,
        resetPasswordRequested: updated.resetPasswordRequested,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Account could not be updated." },
      { status: 409 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session || !canManageAccounts(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  const currentUser = await getManageableUser(id, session);

  if (!currentUser) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.account.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    await logActivity({
      username: session.user.username,
      action: "DELETE_ACCOUNT",
      functionName: "Account management",
      beforeChange: {
        targetUsername: currentUser.username,
        fullName: currentUser.fullName,
        role: currentUser.role,
        bankId: currentUser.bankId,
        isActive: currentUser.isActive,
      },
      afterChange: null,
    });

    return NextResponse.json({ data: { id } });
  } catch {
    return NextResponse.json(
      { error: "Account has related financial records and cannot be deleted." },
      { status: 409 },
    );
  }
}
