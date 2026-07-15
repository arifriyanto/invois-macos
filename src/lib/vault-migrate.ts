// Migrations that rewrite the WHOLE vault, not one collection.
//
// These are different in kind from lib/persist.ts, whose envelope versions a
// single key's shape. Money touches four keys at once (draft invoice, saved
// history, catalog, and it depends on settings for the currency), so it cannot be
// expressed as a per-key migration — the currency lives in a different key than
// the prices it scales. It runs once, at the disk boundary, on the raw map that
// data-store just loaded.
//
// The rules for anything added here:
//   • Pure. Take the map, return whether it changed. No I/O, so it is testable.
//   • Idempotent. A field that has already been migrated must be left alone,
//     because a half-migrated vault (a crash mid-write) will come back through.
//   • Lossless on the way in. If a value is not the shape expected, leave it
//     exactly as found rather than guessing — data-store's safe mode will catch
//     a genuinely broken vault, and a migration must never be the thing that
//     destroys one.

import { isCurrency, migratedQty, toMinor } from "./money";
import type { Currency } from "./types";

const SETTINGS_KEY = "invois_settings";
const INVOICE_KEY = "invois_invoice";
const HISTORY_KEY = "invois_history";
const CATALOG_KEY = "invois_catalog";

type Obj = Record<string, unknown>;

function isObj(x: unknown): x is Obj {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** The currency the stored prices are denominated in.
 *
 *  This works only because currency is a GLOBAL, single-value setting that the
 *  app deliberately locks once a vault holds invoices. If invoices ever carry
 *  their own currency, the scale factor stops being knowable from one place, and
 *  this migration — long finished by then — must not be revived as a model. */
function vaultCurrency(mem: Map<string, string>): Currency {
  try {
    const raw = mem.get(SETTINGS_KEY);
    if (!raw) return "USD";
    const parsed: unknown = JSON.parse(raw);
    const data = isObj(parsed) && "data" in parsed ? parsed.data : parsed; // envelope or bare
    const c = isObj(data) ? data.currency : undefined;
    // isCurrency, not a hand-written list: a currency this guard doesn't know
    // falls back to USD, and a wrong fallback scales every price in the vault by
    // the wrong power of ten. The list must never be able to drift.
    return isCurrency(c) ? c : "USD";
  } catch {
    return "USD";
  }
}

/** true if this line item still carries the old decimal `price`. */
function needsItemMigration(item: unknown): boolean {
  return isObj(item) && "price" in item && !("priceMinor" in item);
}

function migrateItem(item: Obj, currency: Currency): void {
  const price = item.price;
  if (typeof price === "number") {
    item.priceMinor = toMinor(price, currency);
  } else {
    item.priceMinor = 0; // a non-numeric price was already broken; do not invent one
  }
  delete item.price;
  // Quantities become whole numbers at the same time. A stored 2.5 was always
  // going to be rounded somewhere; better here, once, visibly, than silently on
  // every render. The rule (and why it rounds where the others truncate) lives in
  // money.ts, not here — see migratedQty.
  if (typeof item.qty === "number") item.qty = migratedQty(item.qty);
}

/** Line items + a flat discount, in place. Returns true if anything changed. */
function migrateInvoiceData(inv: unknown, currency: Currency): boolean {
  if (!isObj(inv)) return false;
  let changed = false;

  const items = inv.items;
  if (Array.isArray(items)) {
    for (const it of items) {
      if (needsItemMigration(it)) {
        migrateItem(it as Obj, currency);
        changed = true;
      }
    }
  }

  // The discount, renamed `discount` → `discountValue`.
  //
  // The rename is not cosmetic; it is what makes this function idempotent. The
  // value is a percentage OR an amount depending on discountType (see types.ts),
  // and a scaled amount looks exactly like an unscaled one — 5000 is a perfectly
  // plausible "$50 in cents" and a perfectly plausible "$5,000 to be scaled". So
  // there was NO way to tell, from the number, whether the migration had already
  // run. Run it twice — a crash between migrating and saving is enough — and a
  // $50 discount silently becomes $5,000 on invoices already sent.
  //
  // `price` → `priceMinor` never had that problem: the old field name was gone,
  // so its absence was proof. The discount now carries the same proof. (I found
  // this by asserting idempotency and watching it fail, not by reasoning about
  // it; the assertion is in vault-migrate.test.ts and should stay there.)
  if ("discount" in inv && !("discountValue" in inv)) {
    const raw = typeof inv.discount === "number" ? inv.discount : 0;
    // Only the "flat" case is money, so only the "flat" case is scaled. Getting
    // this backwards would turn a 10% discount into 1000%, or shrink Rp 50.000
    // to Rp 500.
    inv.discountValue = inv.discountType === "flat" ? toMinor(raw, currency) : raw;
    delete inv.discount;
    changed = true;
  }

  return changed;
}

/**
 * Vault format 2 → 3: money becomes integer minor units.
 *
 * Mutates `mem` in place and returns true if anything was rewritten (the caller
 * uses that to decide whether the vault needs saving). Returns false for a vault
 * that has nothing to migrate, which is what makes it safe to run on every load.
 */
export function migrateMoneyToMinor(mem: Map<string, string>): boolean {
  const currency = vaultCurrency(mem);
  let changed = false;

  const rewrite = (key: string, fn: (parsed: unknown) => boolean) => {
    const raw = mem.get(key);
    if (raw == null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // unparseable → leave it for safe mode to notice; never rewrite it
    }
    if (fn(parsed)) {
      mem.set(key, JSON.stringify(parsed));
      changed = true;
    }
  };

  // The draft invoice being edited.
  rewrite(INVOICE_KEY, (inv) => migrateInvoiceData(inv, currency));

  // Every saved invoice. These are the records a client has already been sent, so
  // the migrated figures must come out to exactly the same amounts — which they
  // do: scaling every price by the same power of ten and rounding once cannot
  // change a total that was, in practice, always a whole number of cents.
  rewrite(HISTORY_KEY, (list) => {
    if (!Array.isArray(list)) return false;
    let any = false;
    for (const rec of list) {
      if (isObj(rec) && migrateInvoiceData(rec.data, currency)) any = true;
    }
    return any;
  });

  // Saved catalog items.
  rewrite(CATALOG_KEY, (list) => {
    if (!Array.isArray(list)) return false;
    let any = false;
    for (const it of list) {
      if (needsItemMigration(it)) {
        migrateItem(it as Obj, currency);
        any = true;
      }
    }
    return any;
  });

  return changed;
}
