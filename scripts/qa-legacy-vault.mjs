// Membuat vault FORMAT LAMA untuk uji migrasi (Fase 9 di docs/qa-manual-test.md).
//
// Kenapa ini ada: menyuruh orang mengedit JSON dengan tangan adalah instruksi yang
// buruk. Ia lambat, mudah salah, dan kalau hasilnya aneh kamu tidak pernah tahu
// apakah yang salah app-nya atau ketikanmu. Skrip ini membuat filenya persis,
// setiap kali sama.
//
// Yang dibuat: vault format 2 (uang masih DESIMAL, field-nya `price` dan
// `discount`), berisi tiga invoice yang sengaja dipilih:
//
//   INV-001  diskon FLAT $50      ← satu-satunya jalur yang pernah benar-benar
//                                    gagal (menskalakan dua kali: $50 → $5.000).
//                                    NOL dari 789 invoice nyata Arif memakainya,
//                                    jadi data sungguhan tidak pernah mengujinya.
//   INV-002  diskon PERSEN 10%    ← harus TIDAK diskalakan. Kalau tertukar dengan
//                                    yang di atas, 10% jadi 1000%.
//   INV-003  tanpa diskon, pajak  ← kontrol.
//
// Pakai:  node scripts/qa-legacy-vault.mjs ~/Desktop/qa/v-lama
//
// Angka yang harus muncul di app setelah migrasi tertulis di bawah — dan juga
// dicetak ke layar, supaya kamu tidak perlu membolak-balik dokumen.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const arg = process.argv[2];
if (!arg) {
  console.error("pakai: node scripts/qa-legacy-vault.mjs <folder-tujuan>");
  console.error("misal: node scripts/qa-legacy-vault.mjs ~/Desktop/qa/v-lama");
  process.exit(1);
}
const dir = resolve(arg.replace(/^~(?=$|\/)/, homedir()));

const item = (id, desc, qty, price) => ({ id, desc, qty, price });

// Format 2: TIDAK ada penanda "__invois", uang masih desimal, field lama.
const vault = {
  invois_settings: {
    v: 5,
    data: {
      bizName: "Uji Migrasi",
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
      bankOwner: "Uji Migrasi",
      defaultTaxEnabled: false,
      defaultNote: "",
      numReset: "yearly",
      exportDir: "",
    },
  },

  invois_customers: [
    { id: "c1", name: "Klien Uji", email: "klien@example.com", phone: "", address: "" },
  ],

  invois_catalog: [{ id: "k1", desc: "Jasa desain", price: 19.99 }],

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
        note: "Diskon FLAT — inilah yang diuji.",
        client: { name: "Klien Uji", email: "klien@example.com", phone: "", address: "" },
        items: [item("i1", "Jasa desain", 10, 19.99)], // subtotal 199.90
        discountEnabled: true,
        discountType: "flat",
        discount: 50, // $50 — BUKAN 50 sen, BUKAN $5.000
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
        note: "Diskon PERSEN — tidak boleh ikut diskalakan.",
        client: { name: "Klien Uji", email: "klien@example.com", phone: "", address: "" },
        items: [item("i2", "Jasa desain", 10, 19.99)], // subtotal 199.90
        discountEnabled: true,
        discountType: "pct",
        discount: 10, // 10% — tetap 10, jangan jadi 1000
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
        note: "Kontrol: tanpa diskon, dengan pajak.",
        client: { name: "Klien Uji", email: "klien@example.com", phone: "", address: "" },
        items: [item("i3", "Jasa desain", 3, 19.99)], // subtotal 59.97
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

console.log(`Vault FORMAT LAMA dibuat: ${file}`);
console.log(`  (tidak ada "__invois" → app membacanya sebagai format lama)\n`);
console.log("Yang HARUS muncul di app setelah vault ini diadopsi:\n");
console.log("  INV-001   Subtotal $199.90   Diskon $50.00    Total $149.90");
console.log("            ↑ ini yang diuji. BUKAN $0.50, BUKAN $5,000.00.\n");
console.log("  INV-002   Subtotal $199.90   Diskon $19.99    Total $179.91");
console.log("            ↑ diskon 10%, tetap 10% — bukan 1000%.\n");
console.log("  INV-003   Subtotal $59.97    Pajak  $5.10     Total $65.07\n");
console.log("Dan di dalam file, SETELAH kamu menyimpan sesuatu di app:");
console.log('  "__invois": { "format": 3 }');
console.log('  "priceMinor": 1999      (bukan "price": 19.99)');
console.log('  "discountValue": 5000   (dan field "discount" sudah hilang)');
