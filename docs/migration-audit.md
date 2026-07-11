# Audit pasca-migrasi Electron

Tanggal: 11 Juli 2026. Cakupan: seluruh `src/` + `electron/` + konfigurasi build di `invois-macos`.

Dokumen ini menjawab dua pertanyaan: **apakah kodenya benar dan future-proof**, dan **apakah semua
fitur jalan**. Jawaban jujur untuk yang kedua: sebagian belum bisa dipastikan tanpa menjalankan
app — daftarnya ada di bagian terakhir.

---

## 1. Yang terverifikasi secara objektif

| Cek | Hasil |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint src` | bersih (0 error, 0 warning) |
| `vitest run` | 61/61 lulus |
| `node --check electron/*.js` | bersih |
| Sisa referensi `@tauri-apps/*` | nol |
| Sisa `jspdf` / `pdf-lib` | nol (dependensinya dibuang) |
| Dependensi tak terpakai | nol (15/15 dipakai) |

**Diff `invois-macos/src` vs `invois-app/src`** — ini cek paritas yang paling meyakinkan: hanya
**15 file** berbeda, dan setiap perbedaan murni akibat migrasi (tukar API native, PDF, drag region,
mock test). Nol perubahan tak sengaja pada logika bisnis. Artinya store, gating Pro, cap 3 invoice,
vault, i18n, dan template **byte-for-byte sama** dengan versi Tauri yang sudah kamu pakai.

Satu-satunya file baru: `src/lib/native.ts`.

---

## 2. Temuan yang diperbaiki saat audit

Diurutkan dari yang paling berbahaya. Semuanya **tidak akan** tertangkap oleh tsc/eslint/test —
tiga yang pertama hanya muncul di build produksi, yang mana justru saat paling telat ketahuan.

### 🔴 Kritis

**`app://` tidak terdaftar sebagai privileged scheme.** Custom scheme biasa mendapat *opaque
origin*, sehingga `localStorage` melempar error — padahal di situlah pointer vault disimpan. Build
produksi akan boot ke onboarding **setiap kali dibuka**, seolah datanya hilang. Diperbaiki dengan
`protocol.registerSchemesAsPrivileged` + origin tetap `app://invois/`.

**`electron-builder.yml` tidak memaketkan `out/`.** Masih menunjuk `renderer/**` (folder spike yang
sudah dihapus). `.app` hasil build akan berisi **nol UI** — layar putih. Diperbaiki.

**Tidak ada kunci navigasi.** Renderer memegang kunci filesystem (`fs:*` IPC), jadi satu-satunya hal
yang tidak boleh ia lakukan adalah memuat halaman orang lain. Sekarang `will-navigate` dan
`setWindowOpenHandler` menolak semua tujuan di luar app; URL https dilempar ke browser. Ditambah
`sandbox: true` di renderer. **Ini yang membuat permukaan `fs:*` yang luas itu bisa diterima:** tidak
ada kode asing yang bisa mencapainya.

### 🟡 Sedang

**Entitlement `files.downloads.read-write` hilang**, padahal folder export jatuh ke `~/Downloads`
kalau user belum menyetelnya — di sandbox itu ditolak. Ditambahkan.

**Ikon app tidak ada.** Build akan berikon Electron. `build/icon.icns` diambil ulang dari ikon Tauri
(`invois-app/src-tauri/icons/`), plus `app.setName` / About panel / dock icon untuk dev.

**Folder picker selalu buka di Downloads.** Tidak ada `defaultPath` yang dikirim — ini sebenarnya
sudah begitu sejak versi Tauri. Sekarang: vault → Documents, export → folder export yang sedang aktif.

**Tidak ada menu klik-kanan.** Electron tidak memasang menu konteks bawaan, jadi user tidak bisa
paste lewat klik kanan sama sekali. Sekarang ada Cut/Copy/Paste di field teks (semua build), plus
Reload + Inspect element khusus dev.

### 🟢 Ringan

Komentar-komentar peninggalan era WKWebView yang faktanya sudah salah (dan karenanya menyesatkan
siapa pun yang menyentuh kode ini nanti) sudah diperbarui di `format.ts`, `confirm.tsx`, `logo.ts`,
`store.tsx`, `invoice-success-modal.tsx`, `layout.tsx`.

Sampah web dibuang: `app/icon.svg`, `app/apple-icon.svg` (konvensi favicon Next — tak ada tab
browser di app desktop), dan 5 SVG bawaan `create-next-app` di `public/`.

---

## 3. Peta perubahan native

| Tauri | Electron | Catatan |
|---|---|---|
| `plugin-fs` | Node `fs` via IPC | permukaan sama persis |
| `plugin-dialog` | `dialog.showOpenDialog` + **security-scoped bookmark** | **alasan utama migrasi** |
| `plugin-opener` | `shell.openPath` | |
| `api/path` | `app.getPath()` | |
| menu Rust (`lib.rs`) | `Menu` API → event `menu-action` | kontrak event tidak berubah |
| `data-tauri-drag-region` | CSS `.drag-region` | |
| `render_pdf_slice` (Rust) + slicing A4 + pdf-lib + jspdf | **`webContents.printToPDF()`** | 2 library PDF + 1 command Rust hilang |

`src/lib/native.ts` sengaja meniru nama-nama method plugin Tauri (`exists`, `mkdir`, `readTextFile`,
`downloadDir`, `openPath`…), sehingga call site-nya nyaris tidak berubah. Kalau nanti pindah engine
lagi, **satu file itu saja** yang perlu ditulis ulang.

---

## 4. Utang yang disadari (belum dikerjakan)

- **`settings.pdfEngine`** (`"raster" | "vector"`) kini vestigial: PDF selalu vektor, tidak ada lagi
  jalur raster. Field-nya sengaja dibiarkan di skema supaya vault lama tetap terbaca; hapus saat
  migrasi skema berikutnya, jangan sekarang.
- **Kalibrasi PNG.** `PDF_TEXT_NUDGE` (5px) dan lift per-template (Retro −16, Bold −18, Aurora −14)
  di `export.ts` dikalibrasi di **WKWebView**. Mesinnya sekarang Chromium — angkanya kemungkinan
  besar meleset. **Harus dilihat mata.**
- **StoreKit / billing** belum dipasang (Electron punya modul `inAppPurchase` bawaan).
- Dummy data belum disanitasi (email/telepon), audit copywriting pra-rilis, keputusan tracker
  (PostHog), versioning skema untuk `history`/`customers`/`catalog` — semua terbawa dari backlog
  Tauri, tidak terpengaruh migrasi.

---

## 5. Yang TIDAK bisa dipastikan tanpa menjalankan app

Kode boleh bersih, tapi tiga hal ini secara harfiah belum pernah dieksekusi. Ini daftar uji manual,
diurutkan dari yang paling mungkin bermasalah.

1. **Export PDF** — satu-satunya fitur yang mesinnya benar-benar diganti. Cek: margin, halaman kedua
   pada invoice panjang, watermark DRAFT, teks bisa diseleksi di Preview, nama file, auto-open.
2. **Export PNG** — lihat poin kalibrasi di atas. Bandingkan langsung dengan preview.
3. **Vault lintas-relaunch di build sandbox** — butuh Apple Developer Program. Protokolnya ada di
   `README.md`. Ini inti dari seluruh migrasi; sampai ini terbukti, keputusan Electron masih hipotesis.
4. Sisanya (dashboard, gating Pro, cap 3, i18n, template, drag window, menu ⌘N/⌘B) berjalan di atas
   kode yang identik dengan versi Tauri, jadi risikonya rendah — tapi tetap layak diklik sekali.
