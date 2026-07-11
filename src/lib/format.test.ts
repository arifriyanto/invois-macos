import { describe, it, expect } from "vitest";
import { calcTotals, formatCurrency, formatDate, isPremiumTemplate, resolveTemplate } from "./format";
import type { InvoiceData, LineItem } from "./types";

function item(partial: Partial<LineItem> = {}): LineItem {
  return { id: "1", desc: "Item", qty: 1, price: 100, ...partial };
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
    discount: 0,
    discountType: "pct",
    taxEnabled: false,
    taxRate: 0,
    ...partial,
  };
}

describe("calcTotals — subtotal", () => {
  it("sums qty * price across items", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 2, price: 100 }), item({ id: "2", qty: 3, price: 50 })] })
    );
    expect(t.subtotal).toBe(350);
  });

  it("treats negative qty or price as 0 (no negative lines)", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: -5, price: 100 }), item({ id: "2", qty: 2, price: -100 })] })
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
      invoice({ items: [item({ qty: 1, price: 1000 })], discountEnabled: true, discountType: "pct", discount: 10 })
    );
    expect(t.discount).toBe(100);
    expect(t.total).toBe(900);
  });

  it("applies a flat discount", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, price: 1000 })], discountEnabled: true, discountType: "flat", discount: 250 })
    );
    expect(t.discount).toBe(250);
    expect(t.total).toBe(750);
  });

  it("ignores discount when disabled", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, price: 1000 })], discountEnabled: false, discountType: "flat", discount: 250 })
    );
    expect(t.discount).toBe(0);
    expect(t.total).toBe(1000);
  });

  it("clamps a flat discount so total never goes negative", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, price: 500 })], discountEnabled: true, discountType: "flat", discount: 9999 })
    );
    expect(t.discount).toBe(500);
    expect(t.total).toBe(0);
  });

  it("treats a negative discount value as 0", () => {
    const t = calcTotals(
      invoice({ items: [item({ qty: 1, price: 500 })], discountEnabled: true, discountType: "flat", discount: -100 })
    );
    expect(t.discount).toBe(0);
    expect(t.total).toBe(500);
  });
});

describe("calcTotals — tax", () => {
  it("applies tax on the post-discount base", () => {
    const t = calcTotals(
      invoice({
        items: [item({ qty: 1, price: 1000 })],
        discountEnabled: true,
        discountType: "flat",
        discount: 200,
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
      invoice({ items: [item({ qty: 1, price: 1000 })], taxEnabled: false, taxRate: 11 })
    );
    expect(t.tax).toBe(0);
    expect(t.total).toBe(1000);
  });

  it("combines percentage discount and tax correctly", () => {
    const t = calcTotals(
      invoice({
        items: [item({ qty: 2, price: 500 })], // subtotal 1000
        discountEnabled: true,
        discountType: "pct",
        discount: 10, // -100 => 900
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

describe("formatCurrency", () => {
  it("prefixes IDR with 'Rp ' and no decimals", () => {
    expect(formatCurrency(1500000, "IDR")).toBe("Rp 1.500.000");
  });

  it("prefixes USD with '$' and allows 2 decimals", () => {
    expect(formatCurrency(1234.5, "USD")).toBe("$1,234.5");
  });

  it("renders 0 safely", () => {
    expect(formatCurrency(0, "IDR")).toBe("Rp 0");
  });

  it("coerces non-finite numbers to 0", () => {
    expect(formatCurrency(NaN, "USD")).toBe("$0");
    expect(formatCurrency(Infinity, "IDR")).toBe("Rp 0");
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
