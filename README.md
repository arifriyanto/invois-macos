# Invois — Electron (macOS)

Versi **Electron** dari Invois: app penuh (bukan lagi spike). Frontend Next.js-nya sama persis
dengan versi Tauri — yang diganti hanya lapisan native-nya.

Versi Tauri tetap ada di folder sibling **`invois-app/`** sebagai pembanding. Jangan dihapus.

---

## Kenapa pindah ke Electron

Blocker-nya satu: **Tauri belum mendukung *security-scoped bookmarks***
([tauri#3716](https://github.com/tauri-apps/tauri/issues/3716) masih terbuka). Di build **Mac App
Store** (wajib sandbox), folder vault pilihan user **tidak bisa diakses lagi setelah app ditutup
dan dibuka ulang** — user harus memilih ulang folder tiap kali. Itu mematikan model
"datamu, foldermu".

Electron mendukungnya secara native:

1. `dialog.showOpenDialog({ securityScopedBookmarks: true })` → macOS mengembalikan **bookmark
   base64** untuk folder yang dipilih user.
2. Bookmark disimpan di `userData` app (selalu boleh ditulis, tanpa izin apa pun).
3. **Setiap launch**: `app.startAccessingSecurityScopedResource(bookmark)` → pintu sandbox ke
   folder itu terbuka lagi → `fs` Node biasa langsung jalan. Saat quit, `stop()` dipanggil
   (wajib — kalau lupa, macOS membocorkan kernel resource).

Semuanya ada di `electron/main.js`, berkomentar.

---

## Peta arsitektur

```
electron/main.js      proses native: fs, dialog (+bookmark), path, shell, printToPDF, Menu, protokol app://
electron/preload.js   jembatan aman → window.invois   (contextIsolation: true, tanpa Node di UI)
src/lib/native.ts     sisi renderer; nama methodnya SENGAJA meniru API plugin Tauri
src/                  frontend Next.js (sama dengan invois-app)
```

Yang berubah dari versi Tauri:

| Tauri | Electron |
|---|---|
| `plugin-fs` | Node `fs` lewat IPC |
| `plugin-dialog` | `dialog.showOpenDialog` **+ security-scoped bookmark** |
| `plugin-opener` | `shell.openPath` |
| `api/path` | `app.getPath()` |
| menu Rust (`lib.rs`) | `Menu` API → event `menu-action` (kontrak sama) |
| `data-tauri-drag-region` | CSS `-webkit-app-region: drag` (`.drag-region`) |
| `render_pdf_slice` (Rust) + slicing A4 + **pdf-lib** + **jspdf** | **`webContents.printToPDF()`** — Chromium yang paginasi |

**PDF itu penyederhanaan terbesar.** Sekarang: `lib/print.tsx` memasang invoice sebagai
`#print-portal` (anak langsung `<body>`, diparkir jauh di bawah viewport supaya tak terlihat),
lalu aturan `@media print` di `globals.css` menyembunyikan semua anak `<body>` yang lain. Chromium
mencetaknya jadi PDF A4 vektor, teks bisa diseleksi. Dua library PDF dibuang.

PNG masih raster (html2canvas) — memang perlu.

---

## Menjalankan

```bash
cd invois-macos
npm install
npm run dev          # Next dev server + Electron, hot reload
```

`npm run dev:next` menjalankan UI-nya saja di browser (tanpa bridge native: PDF & vault mati).

## Build

```bash
npm run pack:mac      # build biasa (unsandboxed) → dist/
npm run size          # ukuran .app, untuk perbandingan dengan Tauri
```

---

## Uji sandbox (butuh Apple Developer Program)

Ini satu-satunya hal yang **belum terbukti** — perlu sertifikat berbayar.

1. Di Apple Developer portal: daftarkan App ID **`app.invois`**, buat **Mac Development
   certificate**, lalu **provisioning profile development** untuk App ID itu.
2. Simpan profile-nya sebagai **`build/dev.provisionprofile`**.
3. `npm run pack:mas-dev`, lalu jalankan `dist/mas-dev/Invois.app` (**bukan** `npm run dev`).

Protokol ujinya:

| # | Aksi | Yang diharapkan |
|---|------|-----------------|
| 1 | Onboarding → pilih folder vault di luar container (mis. `~/Documents/InvoisTest`) | vault terbuat, invoice bisa disimpan |
| 2 | **Quit total dengan ⌘Q** | — |
| 3 | Buka lagi app-nya | ⬅ **INI UJINYA.** Vault langsung terbaca, **tanpa** memilih ulang folder |
| 4 | Export PDF | file muncul di folder Exports, teksnya bisa diseleksi |

Kalau langkah 3 gagal: cek `build/entitlements.mas.plist` (`files.bookmarks.app-scope` wajib ada)
dan signing-nya. Kalau tetap gagal, tinjau ulang
`invois-app/docs/distribution-and-storage-decision.md` (opsi A / B / C).

---

## Yang belum

- **StoreKit / billing** — Electron punya modul `inAppPurchase` bawaan; belum dipasang.
- **Ukuran app**: Electron ~120–200 MB vs Tauri ~10–20 MB. Ini harga yang dibayar.

Bonus dari pindah ke Chromium: quirk WKWebView hilang (bug `Intl` nama bulan, offset teks
html2canvas, `drawsBackground` private-API, black flash saat maximize).
