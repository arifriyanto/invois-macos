import { describe, expect, it } from "vitest";
import { migrateMoneyToMinor } from "./vault-migrate";

// A vault is a Map<key, JSON string>. These helpers keep the tests readable.
function vault(entries: Record<string, unknown>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(entries)) m.set(k, JSON.stringify(v));
  return m;
}
function read(m: Map<string, string>, key: string): unknown {
  return JSON.parse(m.get(key)!);
}
function settings(currency: string) {
  return { v: 5, data: { currency } };
}

describe("migrateMoneyToMinor — scaling", () => {
  it("multiplies USD prices by 100 (19.99 → 1999)", () => {
    const m = vault({
      invois_settings: settings("USD"),
      invois_invoice: { items: [{ id: "i1", desc: "Design", qty: 3, price: 19.99 }] },
    });

    expect(migrateMoneyToMinor(m)).toBe(true);

    const inv = read(m, "invois_invoice") as { items: Record<string, unknown>[] };
    expect(inv.items[0].priceMinor).toBe(1999);
    expect(inv.items[0].price).toBeUndefined(); // the old field is gone, not shadowed
  });

  it("leaves IDR prices alone — the rupiah IS its own minor unit", () => {
    const m = vault({
      invois_settings: settings("IDR"),
      invois_catalog: [{ id: "c1", desc: "Logo", price: 2_500_000 }],
    });

    migrateMoneyToMinor(m);

    const cat = read(m, "invois_catalog") as Record<string, unknown>[];
    expect(cat[0].priceMinor).toBe(2_500_000); // NOT 250,000,000
  });

  it("migrates every saved invoice in the history", () => {
    const m = vault({
      invois_settings: settings("USD"),
      invois_history: [
        { id: "a", data: { items: [{ id: "i1", qty: 1, price: 100 }] } },
        { id: "b", data: { items: [{ id: "i2", qty: 2, price: 0.05 }] } },
      ],
    });

    migrateMoneyToMinor(m);

    const h = read(m, "invois_history") as { data: { items: Record<string, unknown>[] } }[];
    expect(h[0].data.items[0].priceMinor).toBe(10000);
    expect(h[1].data.items[0].priceMinor).toBe(5);
  });
});

describe("migrateMoneyToMinor — the discount trap", () => {
  // `discount` is a percentage OR an amount depending on discountType. Scaling
  // the wrong one turns 10% into 1000%, or a $50 discount into 50 cents. This is
  // the single most destructive mistake available in this migration.
  it("scales a FLAT discount (it is money) and renames the field", () => {
    const m = vault({
      invois_settings: settings("USD"),
      invois_invoice: { items: [], discountType: "flat", discount: 50 },
    });
    migrateMoneyToMinor(m);
    const inv = read(m, "invois_invoice") as { discountValue: number; discount?: number };
    expect(inv.discountValue).toBe(5000);
    expect(inv.discount).toBeUndefined();
  });

  it("does NOT scale a PERCENTAGE discount (it is not money)", () => {
    const m = vault({
      invois_settings: settings("USD"),
      invois_invoice: { items: [], discountType: "pct", discount: 10 },
    });
    migrateMoneyToMinor(m);
    expect((read(m, "invois_invoice") as { discountValue: number }).discountValue).toBe(10);
  });

  it("does not scale a flat discount TWICE — $50 must not become $5,000", () => {
    // This failed the first time it was asserted. Without the rename there is
    // nothing in the number itself that says whether it has been scaled, and a
    // crash between migrating and saving brings the vault straight back here.
    const m = vault({
      invois_settings: settings("USD"),
      invois_invoice: { items: [], discountType: "flat", discount: 50 },
    });
    migrateMoneyToMinor(m);
    migrateMoneyToMinor(m);
    migrateMoneyToMinor(m);
    expect((read(m, "invois_invoice") as { discountValue: number }).discountValue).toBe(5000);
  });
});

describe("migrateMoneyToMinor — quantities become whole", () => {
  it("rounds a stored fractional qty", () => {
    const m = vault({
      invois_settings: settings("USD"),
      invois_invoice: { items: [{ id: "i1", qty: 2.5, price: 10 }] },
    });
    migrateMoneyToMinor(m);
    const inv = read(m, "invois_invoice") as { items: { qty: number }[] };
    expect(inv.items[0].qty).toBe(3); // 2.5 rounds up, once, visibly
  });
});

describe("migrateMoneyToMinor — safety", () => {
  it("is IDEMPOTENT: running it twice does not scale twice", () => {
    // This is the one that matters. A crash between migrating and saving means
    // the vault comes back through this function again. If it scaled a second
    // time, $19.99 would silently become $1,999.00 — on invoices already sent.
    const m = vault({
      invois_settings: settings("USD"),
      invois_invoice: {
        items: [{ id: "i1", qty: 1, price: 19.99 }],
        discountType: "flat",
        discount: 50,
      },
    });

    expect(migrateMoneyToMinor(m)).toBe(true);
    expect(migrateMoneyToMinor(m)).toBe(false); // nothing left to do
    expect(migrateMoneyToMinor(m)).toBe(false);

    const inv = read(m, "invois_invoice") as { items: { priceMinor: number }[] };
    expect(inv.items[0].priceMinor).toBe(1999); // not 199900
  });

  it("reports no change for a vault that has nothing to migrate", () => {
    const m = vault({ invois_settings: settings("USD"), invois_history: [] });
    expect(migrateMoneyToMinor(m)).toBe(false);
  });

  it("leaves an unparseable value exactly as found", () => {
    // Never rewrite what we could not read — that is how a vault gets destroyed.
    // data-store's safe mode is what should notice this, not the migration.
    const m = new Map<string, string>([
      ["invois_settings", JSON.stringify(settings("USD"))],
      ["invois_history", "{ not json"],
    ]);
    expect(migrateMoneyToMinor(m)).toBe(false);
    expect(m.get("invois_history")).toBe("{ not json");
  });

  it("does not invent a price when the stored one is not a number", () => {
    const m = vault({
      invois_settings: settings("USD"),
      invois_catalog: [{ id: "c1", desc: "Broken", price: "ten dollars" }],
    });
    migrateMoneyToMinor(m);
    const cat = read(m, "invois_catalog") as Record<string, unknown>[];
    expect(cat[0].priceMinor).toBe(0); // zero, not a guess
  });

  it("falls back to USD when settings are missing, rather than throwing", () => {
    const m = vault({ invois_invoice: { items: [{ id: "i1", qty: 1, price: 5 }] } });
    expect(migrateMoneyToMinor(m)).toBe(true);
    const inv = read(m, "invois_invoice") as { items: { priceMinor: number }[] };
    expect(inv.items[0].priceMinor).toBe(500);
  });
});
