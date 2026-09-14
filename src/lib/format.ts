/** A governed FX snapshot rate as one readable line ("1 USD = INR 91.33"), the one canonical formatter for this shape (previously duplicated verbatim in two features). */
export function formatFxSnapshot(currencyCode: string | null, rate: number | null): string {
  if (!currencyCode || currencyCode === "INR") return "INR (no conversion)"
  if (rate === null) return "-"
  return `1 ${currencyCode} = INR ${rate.toFixed(2)}`
}
