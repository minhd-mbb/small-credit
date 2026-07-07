function trimDecimal(value: number) {
  return value.toFixed(3).replace(/\.?0+$/, "");
}

export function formatCompactVnd(value: number) {
  const amount = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (amount >= 1_000_000_000) {
    const millionChunk = Math.floor(amount / 1_000_000);
    const billionText = trimDecimal(millionChunk / 1000);
    const remainder = amount - millionChunk * 1_000_000;
    const remainderText =
      remainder >= 1000 ? ` và ${trimDecimal(remainder / 1000)}K` : "";

    return `${sign}${billionText}B${remainderText} VNĐ`;
  }

  if (amount >= 1_000_000) {
    return `${sign}${trimDecimal(amount / 1_000_000)}M VNĐ`;
  }

  if (amount >= 1000) {
    return `${sign}${trimDecimal(amount / 1000)}K VNĐ`;
  }

  return `${sign}${trimDecimal(amount)} VNĐ`;
}
