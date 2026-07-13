import { createSupabaseServerClientFromHeaders } from "./supabaseServer";
import { prisma } from "./prisma";

export async function getServerSession() {
  const supabase = createSupabaseServerClientFromHeaders();

  const { data, error } = await supabase.auth.getUser();
  const email = data.user?.email;

  if (error || !email) return null;

  const user = await prisma.user.findUnique({ where: { email }, include: { bank: true } });

  if (!user?.isActive) return null;

  return {
    user: {
      id: user.id,
      role: user.role,
      username: user.username,
      fullName: user.fullName,
      bankId: user.bankId,
      bankName: user.bank?.name ?? null,
      bankCode: user.bank?.code ?? null,
      email: user.email ?? undefined,
      name: user.fullName,
    },
  } as const;
}

export default getServerSession;
