const CURRENCY_DECIMAL_PLACES = 2;
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: CURRENCY_DECIMAL_PLACES,
});

export interface ParsedLocalizedAmount {
  canonicalValue: string;
  displayValue: string;
  numericValue: number;
}

export function parseLocalizedVndAmount(
  value: string,
): ParsedLocalizedAmount | null {
  const sanitizedValue = value.replace(/[^\d.,]/g, "");
  const hasDecimalSeparator = sanitizedValue.includes(",");
  const [integerSection = "", ...decimalSections] = sanitizedValue.split(",");
  const integerDigits = integerSection.replace(/\D/g, "");
  const decimalDigits = decimalSections
    .join("")
    .replace(/\D/g, "")
    .slice(0, CURRENCY_DECIMAL_PLACES);

  if (!integerDigits && !decimalDigits) {
    return null;
  }

  const normalizedInteger = integerDigits || "0";
  const canonicalValue = decimalDigits
    ? `${normalizedInteger}.${decimalDigits}`
    : normalizedInteger;
  const numericValue = Number(canonicalValue);
  const formattedInteger = vndFormatter.format(Number(normalizedInteger));
  const displayValue = hasDecimalSeparator
    ? `${formattedInteger},${decimalDigits}`
    : formattedInteger;

  return { canonicalValue, displayValue, numericValue };
}

export function formatCanonicalVndAmount(value: string): string {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? vndFormatter.format(numericValue)
    : "";
}

export function roundVndAmount(value: number): number {
  return (
    Math.round(value * 10 ** CURRENCY_DECIMAL_PLACES) /
    10 ** CURRENCY_DECIMAL_PLACES
  );
}
