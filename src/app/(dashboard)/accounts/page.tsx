import { redirect } from "next/navigation";
import { AccountsManager } from "@/app/(dashboard)/accounts/AccountsManager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const canManage =
    session.user.role === "ADMIN" || session.user.role === "BANK_ADMIN";

  if (!canManage) {
    redirect("/dashboard");
  }

  const where =
    session.user.role === "ADMIN" ? {} : { bankId: session.user.bankId };

  const [users, banks] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { username: "asc" }],
      include: { bank: true },
    }),
    session.user.role === "ADMIN"
      ? prisma.bank.findMany({ orderBy: { name: "asc" } })
      : session.user.bankId
        ? prisma.bank.findMany({
            where: { id: session.user.bankId },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
  ]);

  return (
    <AccountsManager
      banks={banks.map((bank) => ({
        id: bank.id,
        name: bank.name,
      }))}
      currentUser={{
        role: session.user.role,
        bankId: session.user.bankId,
      }}
      initialAccounts={users.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        bankId: user.bankId,
        bankName: user.bank?.name ?? null,
        isActive: user.isActive,
        resetPasswordRequested: user.resetPasswordRequested,
      }))}
    />
  );
}
