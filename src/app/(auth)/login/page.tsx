import { Suspense } from "react";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/(auth)/login/LoginForm";
import { Card } from "@/components/ui/Card";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card dark className="relative hidden min-h-[540px] flex-col justify-between overflow-hidden p-8 lg:flex">
          <div className="absolute -right-14 top-12 h-52 w-52 rotate-12 border border-white/10" />
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white">
              <Lock size={22} />
            </div>
            <h1 className="font-display mt-8 max-w-md text-3xl font-bold leading-tight text-white">
              Credit operations for a small private banking team.
            </h1>
            <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-white/60">
              Monitor accounts, savings, lending and cashflow in one
              SaaS-style workspace.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["48", "Accounts"],
              ["2.4B", "Loans"],
              ["94%", "Health"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-white/10 p-4">
                <p className="font-display text-xl font-bold text-white">
                  {value}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/55">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-8">
          <div>
            <p className="text-sm font-bold text-[var(--primary)]">
              Family Bank
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[var(--text-primary)]">
              Login
            </h2>
            <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
              Use your numeric username and password. Sessions expire after 60
              minutes.
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}
