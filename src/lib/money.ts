import type { Currency } from "./types";

/**
 * Money is an INTEGER number of minor units. Never a float.
 *
 * The bug this replaces: prices were JavaScript numbers, i.e. IEEE-754 binary
 * doubles, and 19.99 is not representable in binary any more than 1/3 is in
 * decimal. So `3 × 19.99` came out as 59.97000000000001, a 10% discount on it as
 * 5.997000000000001, and the invoice quietly disagreed with itself by a fraction
 * of a cent. Intl.NumberFormat rounds the display, which is worse than useless:
 * the screen says the right thing while the stored number says another, and the
 * error compounds every time it is added, taxed, or discounted.
 *
 * A price is not a measurement, it is a COUNT — of cents, of rupiah. Counts are
 * integers, and integers up to 2^53 are exact. So: $19.99 is stored as 1999, and
 * Rp 2.500.000 as 2500000. Nothing rounds until a percentage forces it to.
 *
 * The rule for the rest of the codebase: everything named `*Minor` is an integer
 * in minor units and may be added, subtracted and multiplied by an integer
 * quantity freely. Conversion to a decimal number happens ONLY at the two edges —
 * the input field (text → minor) and the formatter (minor → text). If you find
 * yourself writing `price / 100` anywhere else, something has gone wrong.
 */

/** How many minor units make one major unit. Rupiah has no cents in practice —
 *  sen were withdrawn from circulation decades ago and no Indonesian invoice
 *  carries them — so IDR counts whole rupiah and its "minor unit" IS the rupiah. */
export const MONEY_DECIMALS: Record<Currency, number> = {
  IDR: 0,
  USD: 2,
  SGD: 2,
  EUR: 2,
  GBP: 2,
};

/** The supported currency codes, derived from the table above rather than
 *  retyped. Anything that needs to validate a currency read off disk should use
 *  this — a second hand-written list is a second place to forget a new currency,
 *  and a currency that fails validation falls back to USD, which would scale the
 *  wrong way. */
export const CURRENCY_CODES = Object.keys(MONEY_DECIMALS) as Currency[];

export function isCurrency(x: unknown): x is Currency {
  return typeof x === "string" && x in MONEY_DECIMALS;
}

export function moneyDecimals(currency: Currency): number {
  return MONEY_DECIMALS[currency] ?? 2;
}

/** 10^decimals — how many minor units in one major unit. */
export function minorFactor(currency: Currency): number {
  return 10 ** moneyDecimals(currency);
}

/**
 * Round half away from zero, which is what invoicing expects: 0.5 → 1, 1.5 → 2.
 * JavaScript's Math.round is half-UP (toward +∞), so it disagrees on negatives
 * (Math.round(-0.5) is -0). Money here is never negative, but a rounding helper
 * that is only correct for positives is a trap for whoever reuses it, so it is
 * correct for both.
 */
export function roundHalf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

/** Decimal major units (19.99) → integer minor units (1999). The multiply is the
 *  one place a float is unavoidable, so we round immediately and never look back:
 *  19.99 × 100 is 1998.9999999999998 in binary, and roundHalf turns it into 1999. */
export function toMinor(major: number, currency: Currency): number {
  if (!Number.isFinite(major)) return 0;
  return roundHalf(major * minorFactor(currency));
}

/** Integer minor units (1999) → decimal major units (19.99). For DISPLAY and for
 *  handing to Intl.NumberFormat. Not for arithmetic — do the maths in minor. */
export function toMajor(minor: number, currency: Currency): number {
  if (!Number.isFinite(minor)) return 0;
  return minor / minorFactor(currency);
}

/**
 * A quantity is a whole number of things. Not 2.5 things.
 *
 * This is a product decision, not a technical limit: an invoice line is "3 ×
 * logo revision", and a freelancer billing half a day sells a line item called
 * "half day", not 0.5 of a day. Allowing fractions would drag rounding back into
 * the subtotal (qty × price stops being an integer) for a case the app does not
 * actually have — so quantities are integers, and the input enforces it.
 */
export function normalizeQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

/**
 * The same rule applied to a value we did NOT enter — a hand-edited vault, an old
 * file, a bug. It floors at 0, not 1, and that difference is deliberate: an input
 * of 0 should become 1 (nobody means to bill zero of something they just typed),
 * but a STORED 0 or -5 must contribute nothing rather than be silently promoted
 * into a charge the user never made. Arithmetic errs toward not billing.
 */
export function safeQty(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

/** Same idea for a stored price: whole minor units, never negative. */
export function safeMinor(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

/**
 * The qty rule for a ONE-OFF conversion of an old vault — and the only place that
 * rounds to nearest instead of truncating.
 *
 * It is a third rule, so it owes an explanation. `normalizeQty` truncates because
 * it guards an input: the user is still typing, and "2.5" on the way to "25"
 * must not jump to 3. `safeQty` truncates and floors at 0 because it guards
 * arithmetic and must never invent a charge.
 *
 * This one guards neither. It converts a quantity that was ALREADY BILLED — an
 * invoice whose 2.5 was sent to a client and paid — and any conversion changes
 * the total. Between 2 and 3 the honest choice is the nearer one, so 2.5 becomes
 * 3, once, at the migration, rather than being silently truncated to 2 and
 * quietly shrinking an invoice that has already been settled.
 *
 * (This lived as a bare `Math.max(1, Math.round(n))` inside vault-migrate. Naming
 * it is the point: an unexplained fourth rounding rule sitting in a migration is
 * how two parts of a codebase start disagreeing about what a quantity is.)
 */
export function migratedQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.round(n));
}
