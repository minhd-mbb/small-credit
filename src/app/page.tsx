import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/serverSession";

export default async function Home() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(session.user.role === "ACCOUNT" ? "/dashboard" : "/control-panel");
}
