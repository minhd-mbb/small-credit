import bcrypt from "bcryptjs";
import NextAuth, {
  type DefaultSession,
  type NextAuthConfig,
  type User,
} from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type AppRole = "ADMIN" | "BANK_ADMIN" | "ACCOUNT";

const loginSchema = z.object({
  username: z.string().regex(/^\d{4,10}$/),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      username: string;
      fullName: string;
      bankId: string | null;
      bankName: string | null;
      bankCode: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    username: string;
    fullName: string;
    bankId: string | null;
    bankName: string | null;
    bankCode: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    username?: string;
    fullName?: string;
    bankId?: string | null;
    bankName?: string | null;
    bankCode?: string | null;
  }
}

function readRole(value: unknown): AppRole {
  return value === "ADMIN" || value === "BANK_ADMIN" || value === "ACCOUNT"
    ? value
    : "ACCOUNT";
}

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60,
    updateAge: 5 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.role = readRole(user.role);
        token.username = user.username;
        token.fullName = user.fullName;
        token.bankId = user.bankId;
        token.bankName = user.bankName;
        token.bankCode = user.bankCode;
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = readRole(token.role);
      session.user.username = token.username ?? "";
      session.user.fullName = token.fullName ?? session.user.name ?? "";
      session.user.bankId = token.bankId ?? null;
      session.user.bankName = token.bankName ?? null;
      session.user.bankCode = token.bankCode ?? null;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: parsed.data.username },
          include: { bank: true },
        });

        if (!user?.isActive) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );

        if (!passwordMatches) {
          return null;
        }

        if (user.resetPasswordRequested) {
          await prisma.user.update({
            where: { id: user.id },
            data: { resetPasswordRequested: false },
          });
        }

        return {
          id: user.id,
          name: user.fullName,
          email: user.email ?? undefined,
          role: readRole(user.role),
          username: user.username,
          fullName: user.fullName,
          bankId: user.bankId,
          bankName: user.bank?.name ?? null,
          bankCode: user.bank?.code ?? null,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
