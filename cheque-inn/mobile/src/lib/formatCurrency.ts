export type CurrencyCode = "GHS" | "USD";

function normalizeCurrencyCode(raw: unknown): CurrencyCode {
  return raw === "USD" ? "USD" : "GHS";
}

/**
 * Display-only currency formatter (no conversion).
 * Output examples: "GHS 1,200.00", "USD 500.00"
 */
export function formatCurrency(amount: number, currencyCode: CurrencyCode | string | null | undefined): string {
  const code = normalizeCurrencyCode(currencyCode);
  const n = Number(amount);
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `${code} ${formatted}`;
}

