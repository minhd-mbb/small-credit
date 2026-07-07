import { Prisma } from "@prisma/client";

export const STOCK_TRADE_FEE_RATE = new Prisma.Decimal("0.002");

export function toStockUnitPriceVnd(price: number | Prisma.Decimal) {
  const decimalPrice =
    price instanceof Prisma.Decimal ? price : new Prisma.Decimal(price);

  return decimalPrice.lessThan(1000) ? decimalPrice.mul(1000) : decimalPrice;
}

export function calculateStockTradeAmounts({
  price,
  quantity,
  type,
}: {
  price: number | Prisma.Decimal;
  quantity: number;
  type: "BUY" | "SELL";
}) {
  const unitPrice = toStockUnitPriceVnd(price).toDecimalPlaces(4);
  const grossAmount = unitPrice.mul(quantity).toDecimalPlaces(2);
  const feeAmount = grossAmount.mul(STOCK_TRADE_FEE_RATE).toDecimalPlaces(2);
  const netAmount =
    type === "BUY"
      ? grossAmount.plus(feeAmount).toDecimalPlaces(2)
      : grossAmount.minus(feeAmount).toDecimalPlaces(2);

  return {
    feeAmount,
    grossAmount,
    netAmount,
    unitPrice,
  };
}
