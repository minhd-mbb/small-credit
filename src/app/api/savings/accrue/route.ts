import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { accrueActiveSavingsForUser } from "@/lib/savings-service";

export async function POST() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await accrueActiveSavingsForUser(session.user.id);

  return NextResponse.json({ ok: true });
}
