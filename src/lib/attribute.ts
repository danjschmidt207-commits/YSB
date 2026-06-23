// Attribution: map a Square sale line's modifiers to a flavor and/or schmear type.
// Pure + testable. Resolution order per modifier: explicit override → flavor-name match →
// schmear-name match. Names are matched case-insensitively.

export const IGNORE = "__ignore__";
const SCHMEAR_PREFIX = "schmear:";

// Override values: a number = flavorId; "schmear:<key>" = schmear type; IGNORE = skip.
export type OverrideValue = number | string;

export interface AttributeContext {
  flavorByNorm: Map<string, number>; // normalized flavor name -> flavorId
  schmears: { norm: string; key: string }[]; // schmear type names (normalized) -> key
  overrides: Map<string, OverrideValue>; // normalized modifier/item name -> override
}

export function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function buildContext(
  flavors: { id: number; name: string }[],
  schmearTypes: { key: string; name: string }[],
  overrides: Record<string, OverrideValue>
): AttributeContext {
  return {
    flavorByNorm: new Map(flavors.map((f) => [norm(f.name), f.id])),
    schmears: schmearTypes.map((s) => ({ norm: norm(s.name), key: s.key })),
    overrides: new Map(Object.entries(overrides).map(([k, v]) => [norm(k), v])),
  };
}

export interface LineAttribution {
  flavorId: number | null;
  schmearKey: string | null;
  /** Modifier names that looked meaningful but matched nothing (candidates for manual mapping). */
  unmapped: string[];
}

export interface ModifierAttribution {
  flavorId: number | null;
  schmearKey: string | null;
  /** True if the modifier resolved to a flavor, a schmear, or an explicit ignore. */
  mapped: boolean;
}

/** Attribute a SINGLE modifier (one bagel flavor or one schmear). Used by the importer. */
export function attributeModifier(name: string, ctx: AttributeContext): ModifierAttribution {
  const n = norm(name);
  const ov = ctx.overrides.get(n);
  if (ov === IGNORE) return { flavorId: null, schmearKey: null, mapped: true };
  if (typeof ov === "number") return { flavorId: ov, schmearKey: null, mapped: true };
  if (typeof ov === "string" && ov.startsWith(SCHMEAR_PREFIX)) {
    return { flavorId: null, schmearKey: ov.slice(SCHMEAR_PREFIX.length), mapped: true };
  }
  if (ctx.flavorByNorm.has(n)) return { flavorId: ctx.flavorByNorm.get(n)!, schmearKey: null, mapped: true };
  const schmear = ctx.schmears.find((s) => n.includes(s.norm));
  if (schmear) return { flavorId: null, schmearKey: schmear.key, mapped: true };
  return { flavorId: null, schmearKey: null, mapped: false };
}

export function attributeLine(modifierNames: string[], ctx: AttributeContext): LineAttribution {
  let flavorId: number | null = null;
  let schmearKey: string | null = null;
  const unmapped: string[] = [];

  for (const raw of modifierNames) {
    const n = norm(raw);
    const ov = ctx.overrides.get(n);
    if (ov === IGNORE) continue;
    if (typeof ov === "number") {
      flavorId = flavorId ?? ov;
      continue;
    }
    if (typeof ov === "string" && ov.startsWith(SCHMEAR_PREFIX)) {
      schmearKey = schmearKey ?? ov.slice(SCHMEAR_PREFIX.length);
      continue;
    }
    if (ctx.flavorByNorm.has(n)) {
      flavorId = flavorId ?? ctx.flavorByNorm.get(n)!;
      continue;
    }
    const schmear = ctx.schmears.find((s) => n.includes(s.norm));
    if (schmear) {
      schmearKey = schmearKey ?? schmear.key;
      continue;
    }
    unmapped.push(raw);
  }

  return { flavorId, schmearKey, unmapped };
}
