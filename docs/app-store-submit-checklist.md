# Invois (Electron) — Checklist submit ke Mac App Store

Diperbarui 11 Jul 2026, menggantikan checklist versi Tauri (`invois-app/docs/`), yang
sudah usang: seluruh bagian billing dan build di sana mengasumsikan Rust/Tauri.

Tag: **[Arif]** = kamu (akun, Apple, aset, keputusan) · **[Kode]** = aku bisa kerjakan
di repo · ⛔ = blocker keras (tidak bisa submit tanpanya).

**Kenapa Electron:** Tauri tidak mendukung security-scoped bookmarks, sehingga di
sandbox App Store folder vault pilihan user tidak terbaca lagi setelah app ditutup.
Electron mendukungnya, dan kodenya sudah terpasang — **tapi belum pernah diuji**,
karena pengujiannya butuh sertifikat berbayar. Itu ketidakpastian terbesar yang
tersisa (§5).

---

## 0. Gerbang: keputusan & enrollment

- [ ] ⛔ **[Arif]** Enroll **Apple Developer Program** (US$99/th). Semua langkah lain
      yang menyentuh signing, sandbox, dan IAP terkunci sampai ini beres — termasuk
      pembuktian bookmark sandbox.
- [ ] **[Arif]** Individual (namamu tampil publik) vs Organization (butuh badan usaha
      + D-U-N-S).
- [ ] **[Arif]** Putuskan: **v1 gratis dulu** (tercepat — matikan gate Pro, billing
      menyusul) atau **v1 langsung dengan Pro** (butuh §3, §4, §6 lengkap).
      Rekomendasiku tetap v1 gratis: Pro sebagai update berikutnya sekaligus menepati
      janji "free updates".
- [ ] ⛔ **[Arif]** Setujui **Paid Applications Agreement** + isi data bank & pajak
      (wajib untuk menerima payout IAP — hanya jika ship Pro).

## 1. App Store Connect

- [ ] ⛔ **[Arif]** Buat app record, Bundle ID **`app.invois`** (sudah dipakai di
      `electron-builder.yml`).
- [ ] **[Arif]** Metadata: nama, subtitle, deskripsi, keywords, kategori
      (`public.app-category.business`), **support URL**, **privacy policy URL**.
- [ ] **[Arif]** Screenshot macOS + ikon (ikon sudah ada: `build/icon.icns`).
- [ ] **[Arif]** Privacy nutrition label — isinya bergantung keputusan tracker (§7).

## 2. Produk IAP (hanya jika ship Pro)

- [ ] **[Arif]** IAP **Non-Consumable**, Product ID **`app.invois.pro`**.
- [ ] **[Arif]** Tier harga ≈ US$14.99 (≈ Rp 249.000 — angka yang sudah kita kunci).
- [ ] **[Arif]** Status "Ready to Submit".

## 3. Billing di kode (hanya jika ship Pro)

Berbeda total dari rencana Tauri: Electron punya modul **`inAppPurchase` bawaan**,
tidak perlu plugin komunitas, dan **tidak** memaksa naik ke macOS 13.

- [ ] **[Kode]** Pasang `inAppPurchase` di main process; teruskan status ke renderer
      lewat `preload` (`window.invois.iap`).
- [ ] **[Kode]** `isPro` = `isDevBuild() ? toggleDev : (kepemilikan app.invois.pro)`.
      Titik masuknya sudah ada di `lib/store.tsx` — sekarang masih toggle dev saja.
- [ ] **[Kode]** CTA di upgrade-dialog → `purchaseProduct()`; tombol **Restore
      Purchases** (Apple mewajibkan ada, sering jadi alasan penolakan review).
- [ ] **[Kode]** Harga di popup diambil dari `getProducts()`, bukan konstanta `PRICE`
      yang di-hardcode.
- [ ] **[Kode]** Entitlement IAP di `build/entitlements.mas.plist`.

## 4. Build MAS & signing

- [ ] ⛔ **[Arif]** Sertifikat: **Apple Distribution** + **Mac Installer Distribution**.
- [ ] ⛔ **[Arif]** Provisioning profile untuk `app.invois` → simpan sebagai
      `build/embedded.provisionprofile` (produksi) dan `build/dev.provisionprofile`
      (uji sandbox). Keduanya sudah di-gitignore.
- [x] **[Kode]** `electron-builder.yml`: target `mas` + `masDev`, `hardenedRuntime:
      false`, ikon, `files` memaketkan `out/`.
- [x] **[Kode]** Entitlements: `app-sandbox`, `files.user-selected.read-write`,
      **`files.bookmarks.app-scope`**, `files.downloads.read-write`, `network.client`
      + file `inherit` untuk helper process.
- [ ] **[Arif]** `npm run pack:mas` → hasilkan `.pkg` → upload lewat **Transporter**.

## 5. ⛔ Uji sandbox — pembuktian yang menentukan segalanya

Ini alasan seluruh migrasi. Sampai ini lolos, keputusan Electron masih hipotesis.

- [x] **[Kode]** Bookmark diminta saat folder dipilih, disimpan di `userData`, dan
      dibuka ulang tiap launch (`electron/main.js`); scope ditutup saat quit.
- [ ] ⛔ **[Arif]** `npm run pack:mas-dev` → jalankan `.app` hasil build (**bukan**
      `npm run dev`) → onboarding pilih folder vault di luar container → simpan
      invoice → **⌘Q total** → buka lagi. **Vault harus langsung terbaca tanpa
      memilih ulang folder.** Protokol lengkap ada di `README.md`.
- [ ] **[Arif]** Uji juga di build sandbox: export PDF (tulis file ke folder Exports),
      "Ubah lokasi vault", dan tambah vault kedua.

## 6. Uji fungsional sebelum submit

- [ ] **[Arif]** Sandbox Tester di ASC (email alias, jangan Apple ID aslimu) → uji
      beli, **Restore**, kepemilikan bertahan setelah relaunch.
- [ ] **[Arif/Kode]** Gate free saat `isPro=false`: cap 3 invoice, hanya template
      Minimal, batas 1 vault.
- [ ] **[Arif]** `npm run pdf:fonts` pada PDF hasil build **produksi** (bukan dev) —
      pastikan tidak ada font Apple ter-embed. Ini bukan formalitas; bug ini pernah
      lolos berbulan-bulan.
- [ ] **[Arif]** Kalibrasi ulang **export PNG** — angka nudge teksnya masih warisan
      WKWebView, kemungkinan meleset di Chromium. Butuh mata, bukan kode.

## 7. Privasi & kepatuhan

- [ ] ⛔ **[Arif]** Keputusan **PostHog**: ship atau copot. Catatan: `invois-macos`
      belum punya `.env.local`, jadi saat ini tracker **mati** (key kosong). Kalau
      dicopot → **[Kode]** buang `posthog-js` + `lib/analytics.ts` + env.
- [ ] ⛔ **[Arif]** Privacy policy URL live (wajib di listing).
- [ ] **[Arif]** Nutrition label harus konsisten dengan keputusan di atas. Jangan
      klaim "tidak mengumpulkan data" kalau PostHog ikut ter-ship.

## 8. Higiene pra-rilis

- [ ] **[Kode]** Sanitasi dummy data (email → `example.com`, telepon → placeholder).
      Sudah disepakati, belum dikerjakan.
- [ ] **[Kode]** Audit copywriting menyeluruh (semua string i18n id + en, onboarding,
      settings, dialog, CTA).
- [ ] **[Kode]** Pastikan flag dev tidak bocor ke produksi: menu Developer di Settings
      (`isDevBuild()`), toggle Pro, `SHOW_PREVIEW_EXPORT`, `CELEBRATE_ON_FIRST_SAVE`.
- [ ] **[Arif]** Finalisasi copy marketing + landing (sudah didraft, dipause).

---

## Urutan yang masuk akal

1. **Enroll** (§0) — semua yang penting terkunci di baliknya.
2. **Uji sandbox** (§5) — dahulukan di atas segalanya. Kalau gagal, seluruh rencana
   berubah dan sisa checklist ini tidak relevan.
3. Baru setelah itu: keputusan Pro-vs-gratis, billing, listing, review.

**Status hari ini:** produk & kode ≈ 90% siap. Yang menghalangi bukan kode, melainkan
US$99 dan satu pembuktian yang belum bisa dilakukan tanpanya.
