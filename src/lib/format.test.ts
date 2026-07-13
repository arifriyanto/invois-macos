import { describe, it, expect } from "vitest";
import { calcTotals, formatMoney, formatDate, isPremiumTemplate, resolveTemplate } from "./format";
import type { InvoiceData, LineItem } from "./types";

function item(partial: Partial<LineItem> = {}): LineItem {
  return { id: "1", desc: "Item", qty: 1, priceMinor: 100, ...partial };
}

function invoice(partial: Partial<InvoiceData> = {}): InvoiceData {
  return {
    number: "INV-1",
    date: "2026-01-01",
    due: "2026-01-15",
    note: "",
    client: { name: "", email: "", phone: "", address: "" },
    items: [item()],
    discountEnabled: false,
    discountValue: 0,
    discountType: "pct",
    taxEnabled: false,
    taxRate: 0,
    ...partial,
  };
}

describe("calcTotals — subtotal", () => {
  it("sums qty * price across items", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 2, priceMinor: 100 }), item({ id: "2", qty: 3, priceMinor: 50 })] })
    );
    expect(t.subtotal).toBe(350);
  });

  it("treats negative qty or price as 0 (no negative lines)", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: -5, priceMinor: 100 }), item({ id: "2", qty: 2, priceMinor: -100 })] })
    );
    expect(t.subtotal).toBe(0);
  });

  it("is 0 for an empty item list", () => {
    expect(calcTotals(invoice({ items: [] })).subtotal).toBe(0);
  });
});

describe("calcTotals — discount", () => {
  it("applies a percentage discount", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, priceMinor: 1000 })], discountEnabled: true, discountType: "pct", discountValue: 10 })
    );
    expect(t.discount).toBe(100);
    expect(t.total).toBe(900);
  });

  it("applies a flat discount", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, priceMinor: 1000 })], discountEnabled: true, discountType: "flat", discountValue: 250 })
    );
    expect(t.discount).toBe(250);
    expect(t.total).toBe(750);
  });

  it("ignores discount when disabled", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, priceMinor: 1000 })], discountEnabled: false, discountType: "flat", discountValue: 250 })
    );
    expect(t.discount).toBe(0);
    expect(t.total).toBe(1000);
  });

  it("clamps a flat discount so total never goes negative", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, priceMinor: 500 })], discountEnabled: true, discountType: "flat", discountValue: 9999 })
    );
    expect(t.discount).toBe(500);
    expect(t.total).toBe(0);
  });

  it("treats a negative discount value as 0", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, priceMinor: 500 })], discountEnabled: true, discountType: "flat", discountValue: -100 })
    );
    expect(t.discount).toBe(0);
    expect(t.total).toBe(500);
  });
});

describe("calcTotals — tax", () => {
  it("applies tax on the post-discount base", () => {
    const t = calcTotals(
      invoice({
        items: [item({ qty: 1, priceMinor: 1000 })],
        discountEnabled: true,
        discountType: "flat",
        discountValue: 200,
        taxEnabled: true,
        taxRate: 11,
      })
    );
    // base = 1000 - 200 = 800; tax = 11% = 88
    expect(t.tax).toBe(88);
    expect(t.total).toBe(888);
  });

  it("ignores tax when disabled", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, priceMinor: 1000 })], taxEnabled: false, taxRate: 11 })
    );
    expect(t.tax).toBe(0);
    expect(t.total).toBe(1000);
  });

  it("combines percentage discount and tax correctly", () => {
    const t = calcTotals(
      invoice({
        items: [item({ qty: 2, priceMinor: 500 })], // subtotal 1000
        discountEnabled: true,
        discountType: "pct",
        discountValue: 10, // -100 => 900
        taxEnabled: true,
        taxRate: 10, // +90
      })
    );
    expect(t.subtotal).toBe(1000);
    expect(t.discount).toBe(100);
    expect(t.tax).toBe(90);
    expect(t.total).toBe(990);
  });
});

// The bug that motivated integer money, pinned so it cannot come back.
//
// Under floats, `3 × 19.99` was 59.97000000000001 and a 10% discount on it was
// 5.997000000000001. Every assertion below is an exact integer, and an exact
// integer is a thing a float subtotal could not have produced.
describe("calcTotals — the float bug (regression)", () => {
  const usd = (major: number) => Math.round(major * 100); // 19.99 → 1999

  it("3 × $19.99 is exactly $59.97, not $59.97000000000001", () => {
    const t = calcTotals(invoice({ items: [item({ qty: 3, priceMinor: usd(19.99) })] }));
    expect(t.subtotal).toBe(5997);
    expect(Number.isInteger(t.subtotal)).toBe(true);
  });

  it("10% off 3 × $19.99, plus 8.5% tax, comes out exact", () => {
    const t = calcTotals(
      invoice({
        items: [item({ qty: 3, priceMinor: usd(19.99) })], // 5997
        discountEnabled: true,
        discountType: "pct",
        discountValue: 10, // 599.7 → rounds to 600
        taxEnabled: true,
        taxRate: 8.5, // 8.5% of 5397 = 458.745 → rounds to 459
      })
    );
    expect(t.subtotal).toBe(5997); // $59.97
    expect(t.discount).toBe(600); // $6.00
    expect(t.tax).toBe(459); // $4.59
    expect(t.total).toBe(5856); // $58.56
    // The property a client checks with a calculator: the printed parts add up
    // to the printed total. Rounding each part ONCE and summing the rounded
    // parts is what guarantees it.
    expect(t.subtotal - t.discount + t.tax).toBe(t.total);
    for (const v of Object.values(t)) expect(Number.isInteger(v)).toBe(true);
  });

  it("rounds a half-unit discount away from zero", () => {
    // 50% of 1 unit = 0.5 → 1, not 0.
    const t = calcTotals(
      invoice({
        items: [item({ qty: 1, priceMinor: 1 })],
        discountEnabled: true,
        discountType: "pct",
        discountValue: 50,
      })
    );
    expect(t.discount).toBe(1);
  });

  it("never lets a fractional stored qty back into the sum", () => {
    // A hand-edited vault could still contain 2.5. It must not produce half a
    // cent — it is truncated, and the subtotal stays whole.
    const t = calcTotals(invoice({ items: [item({ qty: 2.5, priceMinor: 999 })] }));
    expect(t.subtotal).toBe(1998); // 2 × 999, not 2497.5
  });
});

describe("formatMoney", () => {
  it("prefixes IDR with 'Rp ' and no decimals (the minor unit IS the rupiah)", () => {
    expect(formatMoney(1_500_000, "IDR")).toBe("Rp 1.500.000");
  });

  it("renders USD cents as a decimal", () => {
    expect(formatMoney(123450, "USD")).toBe("$1,234.50");
    expect(formatMoney(1999, "USD")).toBe("$19.99");
  });

  it("always shows the currency's full precision", () => {
    // "$19.90", never "$19.9" — and "$100.00", never "$100". An invoice that
    // drops a trailing zero looks like a typo to the person paying it.
    expect(formatMoney(1990, "USD")).toBe("$19.90");
    expect(formatMoney(10000, "USD")).toBe("$100.00");
  });

  it("renders 0 safely", () => {
    expect(formatMoney(0, "IDR")).toBe("Rp 0");
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("coerces non-finite numbers to 0", () => {
    expect(formatMoney(NaN, "USD")).toBe("$0.00");
    expect(formatMoney(Infinity, "IDR")).toBe("Rp 0");
  });
});

describe("formatDate", () => {
  it("returns an em dash for empty input", () => {
    expect(formatDate("", "id")).toBe("—");
  });

  it("returns an em dash for an invalid date", () => {
    expect(formatDate("not-a-date", "en")).toBe("—");
  });

  it("formats in Indonesian long form", () => {
    expect(formatDate("2026-01-05", "id")).toBe("5 Januari 2026");
  });

  it("formats in English long form", () => {
    expect(formatDate("2026-01-05", "en")).toBe("January 5, 2026");
  });
});

describe("isPremiumTemplate", () => {
  it("flags every non-Minimal template as premium", () => {
    expect(isPremiumTemplate("bold")).toBe(true);
    expect(isPremiumTemplate("elegant")).toBe(true);
    expect(isPremiumTemplate("retro")).toBe(true);
    expect(isPremiumTemplate("aurora")).toBe(true);
    expect(isPremiumTemplate("mono")).toBe(true);
  });

  it("treats Minimal (the only free template) as free", () => {
    expect(isPremiumTemplate("minimal")).toBe(false);
  });
});

describe("resolveTemplate", () => {
  it("falls a free user back to Minimal for premium templates", () => {
    expect(resolveTemplate("aurora", false)).toBe("minimal");
    expect(resolveTemplate("bold", false)).toBe("minimal");
  });

  it("leaves the free template untouched for free users", () => {
    expect(resolveTemplate("minimal", false)).toBe("minimal");
  });

  it("keeps whatever a Pro user picked", () => {
    expect(resolveTemplate("aurora", true)).toBe("aurora");
    expect(resolveTemplate("minimal", true)).toBe("minimal");
  });
});
