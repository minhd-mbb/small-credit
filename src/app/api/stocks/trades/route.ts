import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { getServerSession } from "@/lib/serverSession";
import { ensureBankFund } from "@/lib/funds-service";
import { prisma } from "@/lib/prisma";
import { calculateStockTradeAmounts } from "@/lib/stock-trading";
import { stockTradeSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ACCOUNT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = stockTradeSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Thông tin giao dịch chứng khoán không hợp lệ." },
      { status: 400 },
    );
  }

  const { quantity, symbol, type } = payload.data;
  const [account, watchlistItem, priceCache] = await Promise.all([
    prisma.account.findFirst({
      where: {
        status: "ACTIVE",
        type: "CHECKING",
        userId: session.user.id,
        user: { role: "ACCOUNT", isActive: true },
      },
    }),
    prisma.stockWatchlistItem.findUnique({
      where: {
        userId_symbol: {
          symbol,
          userId: session.user.id,
        },
      },
    }),
    prisma.stockPriceCache.findUnique({ where: { symbol } }),
  ]);

  if (!account) {
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản thanh toán active." },
      { status: 404 },
    );
  }

  if (!account.bankId) {
    return NextResponse.json(
      { error: "Tài khoản chưa thuộc bank nên không thể giao dịch chứng khoán." },
      { status: 400 },
    );
  }

  if (!watchlistItem) {
    return NextResponse.json(
      { error: "Chỉ được giao dịch mã chứng khoán trong danh sách theo dõi." },
      { status: 400 },
    );
  }

  if (!priceCache?.price) {
    return NextResponse.json(
      { error: "Mã chứng khoán chưa có giá đồng bộ." },
      { status: 400 },
    );
  }

  const { feeAmount, grossAmount, netAmount, unitPrice } =
    calculateStockTradeAmounts({
      price: priceCache.price,
      quantity,
      type,
    });
  const refId = randomUUID();

  if (type === "BUY" && account.balance.lessThan(netAmount)) {
    return NextResponse.json(
      { error: "Không đủ số dư tài khoản" },
      { status: 400 },
    );
  }

  const existingHolding = await prisma.stockHolding.findUnique({
    where: {
      userId_symbol: {
        symbol,
        userId: session.user.id,
      },
    },
  });

  if (type === "SELL" && (!existingHolding || existingHolding.quantity < quantity)) {
    return NextResponse.json(
      { error: "Không đủ số lượng chứng khoán để bán." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bankFund = await ensureBankFund(account.bankId!, tx);
      let updatedHolding;

      if (type === "BUY") {
        const debited = await tx.account.updateMany({
          where: {
            balance: { gte: netAmount },
            id: account.id,
          },
          data: { balance: { decrement: netAmount } },
        });

        if (debited.count !== 1) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        if (existingHolding) {
          const newQuantity = existingHolding.quantity + quantity;
          const newTotalCost = existingHolding.totalCost.plus(grossAmount);
          updatedHolding = await tx.stockHolding.update({
            where: { id: existingHolding.id },
            data: {
              accountId: account.id,
              averageCostPrice: newTotalCost
                .div(newQuantity)
                .toDecimalPlaces(4),
              bankId: account.bankId,
              quantity: newQuantity,
              totalCost: newTotalCost.toDecimalPlaces(2),
            },
          });
        } else {
          updatedHolding = await tx.stockHolding.create({
            data: {
              accountId: account.id,
              averageCostPrice: unitPrice,
              bankId: account.bankId,
              quantity,
              symbol,
              totalCost: grossAmount,
              userId: session.user.id,
            },
          });
        }
      } else {
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: netAmount } },
        });

        const remainingQuantity = existingHolding!.quantity - quantity;

        if (remainingQuantity === 0) {
          await tx.stockHolding.delete({ where: { id: existingHolding!.id } });
          updatedHolding = null;
        } else {
          const remainingTotalCost = existingHolding!.averageCostPrice
            .mul(remainingQuantity)
            .toDecimalPlaces(2);
          updatedHolding = await tx.stockHolding.update({
            where: { id: existingHolding!.id },
            data: {
              quantity: remainingQuantity,
              totalCost: remainingTotalCost,
            },
          });
        }
      }

      await tx.fund.update({
        where: { id: bankFund.id },
        data: { balance: { increment: feeAmount } },
      });
      const updatedFund = await tx.fund.findUniqueOrThrow({
        where: { id: bankFund.id },
      });

      const updatedAccount = await tx.account.findUniqueOrThrow({
        where: { id: account.id },
      });

      await tx.fundTransaction.create({
        data: {
          amount: feeAmount,
          balanceAfter: updatedFund.balance,
          createdBy: session.user.username,
          fundId: bankFund.id,
          reason: `Stock ${type.toLowerCase()} fee ${symbol}`,
          refId,
          type: "STOCK_TRADE_FEE",
        },
      });

      await tx.transaction.create({
        data: {
          accountId: account.id,
          amount: netAmount,
          balanceAfter: updatedAccount.balance,
          createdBy: session.user.username,
          description:
            type === "BUY"
              ? `Buy ${quantity} ${symbol}`
              : `Sell ${quantity} ${symbol}`,
          refId,
          refType: type === "BUY" ? "STOCK_BUY" : "STOCK_SELL",
          type: type === "BUY" ? "WITHDRAWAL" : "DEPOSIT",
        },
      });

      const trade = await tx.stockTrade.create({
        data: {
          accountId: account.id,
          balanceAfter: updatedAccount.balance,
          bankId: account.bankId,
          feeAmount,
          grossAmount,
          netAmount,
          price: unitPrice,
          quantity,
          refId,
          symbol,
          type,
          userId: session.user.id,
        },
      });

      return { trade, updatedAccount, updatedFund, updatedHolding };
    });

    await logActivity({
      username: session.user.username,
      action: type === "BUY" ? "STOCK_BUY" : "STOCK_SELL",
      functionName: "Stock investment",
      beforeChange: {
        accountBalance: account.balance.toString(),
        holding: existingHolding
          ? {
              averageCostPrice: existingHolding.averageCostPrice.toString(),
              quantity: existingHolding.quantity,
              symbol: existingHolding.symbol,
              totalCost: existingHolding.totalCost.toString(),
            }
          : null,
      },
      afterChange: {
        feeAmount: feeAmount.toString(),
        grossAmount: grossAmount.toString(),
        netAmount: netAmount.toString(),
        price: unitPrice.toString(),
        quantity,
        refId,
        symbol,
        accountBalance: result.updatedAccount.balance.toString(),
        holding: result.updatedHolding
          ? {
              averageCostPrice: result.updatedHolding.averageCostPrice.toString(),
              quantity: result.updatedHolding.quantity,
              symbol: result.updatedHolding.symbol,
              totalCost: result.updatedHolding.totalCost.toString(),
            }
          : null,
      },
    });

    return NextResponse.json({
      data: {
        balance: result.updatedAccount.balance.toString(),
        feeAmount: feeAmount.toString(),
        grossAmount: grossAmount.toString(),
        netAmount: netAmount.toString(),
        price: unitPrice.toString(),
        refId,
        tradeId: result.trade.id,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Không đủ số dư tài khoản" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Không thể hoàn tất giao dịch chứng khoán." },
      { status: 500 },
    );
  }
}
