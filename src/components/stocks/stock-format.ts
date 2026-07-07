export const stockMoneyFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

export function toStockUnitPriceVnd(price: number) {
  return price < 1000 ? price * 1000 : price;
}

export function formatStockMoney(value: number) {
  return `${stockMoneyFormatter.format(Math.round(value))} VNĐ`;
}

export function calculateStockTradePreview({
  price,
  quantity,
  type,
}: {
  price: number;
  quantity: number;
  type: "BUY" | "SELL";
}) {
  const unitPrice = toStockUnitPriceVnd(price);
  const grossAmount = unitPrice * quantity;
  const feeAmount = grossAmount * 0.002;
  const netAmount =
    type === "BUY" ? grossAmount + feeAmount : grossAmount - feeAmount;

  return {
    feeAmount,
    grossAmount,
    netAmount,
    unitPrice,
  };
}
