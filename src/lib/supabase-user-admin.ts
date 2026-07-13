import type { User as SupabaseUser } from "@supabase/supabase-js";
import { deriveSupabasePassword } from "@/lib/supabase-password";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface SupabaseUserProfile {
  fullName: string;
  role: string;
  isActive: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findSupabaseUserByEmail(
  email: string,
): Promise<SupabaseUser | null> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);

  return data.users.find(
    (user: SupabaseUser) => user.email?.toLowerCase() === normalizedEmail,
  ) ?? null;
}

export async function createSupabaseUser(
  email: string,
  password: string,
  profile: SupabaseUserProfile,
): Promise<SupabaseUser> {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: await deriveSupabasePassword(password),
    email_confirm: true,
    user_metadata: {
      full_name: profile.fullName,
      role: profile.role,
      is_active: profile.isActive,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error("Supabase user could not be created.");
  }

  return data.user;
}

export async function updateSupabaseUser(
  currentEmail: string,
  nextEmail: string,
  profile: SupabaseUserProfile,
): Promise<void> {
  const authUser = await findSupabaseUserByEmail(currentEmail);

  if (!authUser) {
    throw new Error("Supabase user does not exist.");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    email: normalizeEmail(nextEmail),
    email_confirm: true,
    user_metadata: {
      full_name: profile.fullName,
      role: profile.role,
      is_active: profile.isActive,
    },
  });

  if (error) {
    throw error;
  }
}

export async function updateSupabaseUserPassword(
  email: string,
  password: string,
): Promise<void> {
  const authUser = await findSupabaseUserByEmail(email);

  if (!authUser) {
    throw new Error("Supabase user does not exist.");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    password: await deriveSupabasePassword(password),
  });

  if (error) {
    throw error;
  }
}

export async function deleteSupabaseUser(email: string): Promise<void> {
  const authUser = await findSupabaseUserByEmail(email);

  if (!authUser) {
    return;
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

  if (error) {
    throw error;
  }
}
