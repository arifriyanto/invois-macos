import { describe, it, expect } from "vitest";
import { buildView } from "./view";
import type { BusinessSettings, InvoiceData, LineItem } from "./types";

// Identity translator: returns the key, enough to exercise view logic.
const t = (k: string) => k;

function bk(partial: Partial<BusinessSettings> = {}): BusinessSettings {
  return {
    logo: null,
    bizName: "",
    email: "",
    phone: "",
    address: "",
    color: "",
    headerBrand: "logo",
    currency: "IDR",
    invPrefix: "INV",
    bankName: "",
    bankAccount: "",
    bankOwner: "",
    ...partial,
  };
}

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

describe("buildView — items", () => {
  it("drops empty rows (no desc and no price)", () => {
    const v = buildView(
      bk(),
      invoice({ items: [item({ id: "1", desc: "Real", price: 100 }), item({ id: "2", desc: "", price: 0 })] }),
      t,
      "id"
    );
    expect(v.items).toHaveLength(1);
    expect(v.items[0].desc).toBe("Real");
  });

  it("keeps a row that has a price but no description, showing an em dash", () => {
    const v = buildView(bk(), invoice({ items: [item({ desc: "", price: 500 })] }), t, "id");
    expect(v.items).toHaveLength(1);
    expect(v.items[0].desc).toBe("—");
  });

  it("computes each line subtotal, flooring negatives to 0", () => {
    const v = buildView(
      bk(),
      invoice({ items: [item({ qty: 3, price: 100 }), item({ id: "2", desc: "x", qty: -1, price: 100 })] }),
      t,
      "id"
    );
    expect(v.items[0].sub).toBe(300);
    expect(v.items[1].sub).toBe(0);
  });
});

describe("buildView — payment", () => {
  it("lists only the filled bank fields", () => {
    const v = buildView(bk({ bankName: "BCA", bankAccount: "123", bankOwner: "" }), invoice(), t, "id");
    expect(v.payment).toEqual(["BCA", "123"]);
  });

  it("falls back to an em dash when no bank info is set", () => {
    const v = buildView(bk(), invoice(), t, "id");
    expect(v.payment).toEqual(["—"]);
  });
});

describe("buildView — placeholders & passthrough", () => {
  it("uses placeholder keys when business and client names are empty", () => {
    const v = buildView(bk(), invoice(), t, "id");
    expect(v.bizName).toBe("inv.bizPlaceholder");
    expect(v.clName).toBe("inv.clientPlaceholder");
  });

  it("passes the note through unchanged", () => {
    const v = buildView(bk(), invoice({ note: "Terima kasih" }), t, "id");
    expect(v.note).toBe("Terima kasih");
  });

  it("exposes the discount percentage label only for pct type", () => {
    const pct = buildView(bk(), invoice({ discountType: "pct", discount: 15 }), t, "id");
    const flat = buildView(bk(), invoice({ discountType: "flat", discount: 15 }), t, "id");
    expect(pct.discountPctLabel).toBe(" (15%)");
    expect(flat.discountPctLabel).toBe("");
  });
});
