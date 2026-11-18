// Deux montants TTC (en euros) diffèrent-ils au centime près ?
export function priceChanged(before: number, after: number): boolean {
  return Math.round(before * 100) !== Math.round(after * 100)
}
