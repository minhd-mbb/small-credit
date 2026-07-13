import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const localUsers = await prisma.user.findMany({
  where: { email: { not: null } },
  orderBy: { createdAt: "asc" },
});
const { data: authData, error: listError } =
  await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

if (listError) {
  throw listError;
}

const authEmails = new Set(
  authData.users.flatMap((user) =>
    user.email ? [user.email.toLowerCase()] : [],
  ),
);
let createdCount = 0;

for (const user of localUsers) {
  if (!user.email) {
    continue;
  }

  const email = user.email.trim().toLowerCase();

  if (user.username !== email) {
    await prisma.user.update({
      where: { id: user.id },
      data: { username: email, email },
    });
  }

  if (authEmails.has(email)) {
    continue;
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      role: user.role,
      is_active: user.isActive,
    },
  });

  if (error) {
    throw error;
  }

  authEmails.add(email);
  createdCount += 1;
}

await prisma.$disconnect();
console.log(
  `Synchronized ${localUsers.length} local users; created ${createdCount} Supabase users.`,
);
