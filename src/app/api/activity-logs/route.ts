import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? 15), 15);

  const logs = await prisma.activityLog.findMany({
    where: { username: session.user.username },
    orderBy: { time: "desc" },
    take,
  });

  return NextResponse.json({ data: logs });
}
