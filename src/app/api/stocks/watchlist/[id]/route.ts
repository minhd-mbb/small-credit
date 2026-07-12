import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/serverSession";
import { prisma } from "@/lib/prisma";
import { stockWatchlistUpdateSchema } from "@/lib/validations";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();

  if (!session || session.user.role !== "ACCOUNT") {
    return forbidden();
  }

  const { id } = await params;
  const payload = stockWatchlistUpdateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid stock symbol" }, { status: 400 });
  }

  const item = await prisma.stockWatchlistItem.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!item) {
    return NextResponse.json({ error: "Stock symbol not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.stockWatchlistItem.update({
      where: { id },
      data: { symbol: payload.data.symbol },
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json(
      { error: "Mã chứng khoán đã có trong danh sách theo dõi." },
      { status: 409 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();

  if (!session || session.user.role !== "ACCOUNT") {
    return forbidden();
  }

  const { id } = await params;
  const item = await prisma.stockWatchlistItem.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!item) {
    return NextResponse.json({ error: "Stock symbol not found" }, { status: 404 });
  }

  await prisma.stockWatchlistItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
