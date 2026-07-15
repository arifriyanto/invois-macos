// Build an OLD-FORMAT vault for the migration test (Phase 9 in docs/qa-manual-test.md).
//
// Why this exists: telling someone to hand-edit JSON is a bad instruction. It is
// slow, easy to get wrong, and when the result looks odd you can never tell whether
// the app or your typing is at fault. This script writes the exact file, identically
// every time.
//
// What it writes: a format-2 vault (money still DECIMAL, fields `price` and
// `discount`), holding three deliberately chosen invoices:
//
//   INV-001  FLAT discount $50     <- the only path that ever actually failed
//                                     (scaled twice: $50 -> $5,000). ZERO of Arif's
//                                     789 real invoices exercise it, so real data
//                                     never tested it.
//   INV-002  PERCENT discount 10%  <- must NOT be scaled. If swapped with the one
//                                     above, 10% becomes 1000%.
//   INV-003  no discount, with tax <- control.
//
// Usage:  node scripts/qa-legacy-vault.mjs ~/Desktop/qa/v-lama
//
// The numbers the app must show after migration are listed below and also printed
// to the screen, so you do not have to flip back to the doc.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const arg = process.argv[2];
if (!arg) {
  console.error("usage:   node scripts/qa-legacy-vault.mjs <target-folder>");
  console.error("example: node scripts/qa-legacy-vault.mjs ~/Desktop/qa/v-lama");
  process.exit(1);
}
const dir = resolve(arg.replace(/^~(?=$|\/)/, homedir()));

const item = (id, desc, qty, price) => ({ id, desc, qty, price });

// Format 2: NO "__invois" marker, money still decimal, old field names.
const vault = {
  invois_settings: {
    v: 5,
    data: {
      bizName: "Migration Test",
      email: "hello@example.com",
      phone: "+1 (415) 555-xxxx",
      address: "1 Test Street",
      currency: "USD",
      invPrefix: "INV",
      numFormat: "{PREFIX}-{SEQ}",
      numPadding: 3,
      dateFormat: "long",
      palette: "corporate",
      pdfEngine: "vector",
      paymentTermDays: 14,
      defaultTaxRate: 8.5,
      logo: null,
      headerBrand: "name",
      color: "#1a1a2e",
      bankName: "First National Bank",
      bankAccount: "1234567890",
      bankOwner: "Migration Test",
      defaultTaxEnabled: false,
      defaultNote: "",
      numReset: "yearly",
      exportDir: "",
    },
  },

  invois_customers: [
    { id: "c1", name: "Test Client", email: "client@example.com", phone: "", address: "" },
  ],

  invois_catalog: [{ id: "k1", desc: "Design service", price: 19.99 }],

  invois_history: [
    {
      id: "inv-flat",
      paid: false,
      updatedAt: Date.now() - 3000,
      template: "minimal",
      data: {
        number: "INV-001",
        date: "2026-07-01",
        due: "2026-07-15",
        note: "FLAT discount — this is what's under test.",
        client: { name: "Test Client", email: "client@example.com", phone: "", address: "" },
        items: [item("i1", "Design service", 10, 19.99)], // subtotal 199.90
        discountEnabled: true,
        discountType: "flat",
        discount: 50, // $50 — NOT 50 cents, NOT $5,000
        taxEnabled: false,
        taxRate: 0,
      },
    },
    {
      id: "inv-pct",
      paid: false,
      updatedAt: Date.now() - 2000,
      template: "minimal",
      data: {
        number: "INV-002",
        date: "2026-07-02",
        due: "2026-07-16",
        note: "PERCENT discount — must not be scaled.",
        client: { name: "Test Client", email: "client@example.com", phone: "", address: "" },
        items: [item("i2", "Design service", 10, 19.99)], // subtotal 199.90
        discountEnabled: true,
        discountType: "pct",
        discount: 10, // 10% — stays 10, must not become 1000
        taxEnabled: false,
        taxRate: 0,
      },
    },
    {
      id: "inv-plain",
      paid: true,
      paidAt: "2026-07-05",
      updatedAt: Date.now() - 1000,
      template: "minimal",
      data: {
        number: "INV-003",
        date: "2026-07-03",
        due: "2026-07-17",
        note: "Control: no discount, with tax.",
        client: { name: "Test Client", email: "client@example.com", phone: "", address: "" },
        items: [item("i3", "Design service", 3, 19.99)], // subtotal 59.97
        discountEnabled: false,
        discountType: "pct",
        discount: 0,
        taxEnabled: true,
        taxRate: 8.5,
      },
    },
  ],
};

mkdirSync(dir, { recursive: true });
const file = resolve(dir, "invois-data.json");
writeFileSync(file, JSON.stringify(vault, null, 2));

console.log(`OLD-FORMAT vault written: ${file}`);
console.log(`  (no "__invois" -> the app reads it as an old format)\n`);
console.log("What the app MUST show once this vault is adopted:\n");
console.log("  INV-001   Subtotal $199.90   Discount $50.00   Total $149.90");
console.log("            ^ this is the test. NOT $0.50, NOT $5,000.00.\n");
console.log("  INV-002   Subtotal $199.90   Discount $19.99   Total $179.91");
console.log("            ^ 10% discount, stays 10% — not 1000%.\n");
console.log("  INV-003   Subtotal $59.97    Tax      $5.10    Total $65.07\n");
console.log("And inside the file, AFTER you save something in the app:");
console.log('  "__invois": { "format": 3 }');
console.log('  "priceMinor": 1999      (not "price": 19.99)');
console.log('  "discountValue": 5000   (and the "discount" field is gone)');
