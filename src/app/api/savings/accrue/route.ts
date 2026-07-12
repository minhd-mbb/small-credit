import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { accrueActiveSavingsForUser } from "@/lib/savings-service";

export async function POST() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await accrueActiveSavingsForUser(session.user.id);

  return NextResponse.json({ ok: true });
}
