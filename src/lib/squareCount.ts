// Pure quantity helpers for the Square importer (no external imports, so they're unit-testable
// in isolation). The counting rule here is verified against the operator's Square item export.

export function intQty(v: string | undefined): number {
  const n = Math.round(Number(v ?? "1"));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Bagels/tubs represented by one modifier selection. A Square modifier's quantity is PER LINE-UNIT,
 * so multiply by the line quantity. Examples:
 *   Single ×2, modifier "Everything" (qty 1)  -> 2
 *   6-box ×1, modifier "Everything ×2"         -> 2
 *   2× 6-box, modifier "Everything ×2"         -> 4
 */
export function modifierUnitQty(modQty: string | undefined, lineQty: string | undefined): number {
  return intQty(modQty) * intQty(lineQty);
}
