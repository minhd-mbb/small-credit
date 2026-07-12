import { redirect } from "next/navigation";
import { BankManagement } from "@/app/(dashboard)/control-panel/banks/BankManagement";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";

export default async function BankManagementPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/control-panel");
  }

  const banks = await prisma.bank.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          users: true,
          accounts: true,
        },
      },
    },
  });

  return <BankManagement initialBanks={banks} />;
}
