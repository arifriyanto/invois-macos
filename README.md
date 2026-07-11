# Invois — Electron (macOS)

Versi Electron dari Invois. **Saat ini masih berupa *spike***, bukan aplikasi utuh.

Versi Tauri yang lengkap ada di folder sibling **`invois-app/`** dan tetap dipertahankan
sebagai pembanding. Jangan hapus.

---

## Kenapa spike ini ada

Kita menemukan blocker: **Tauri belum mendukung *security-scoped bookmarks***
([tauri#3716](https://github.com/tauri-apps/tauri/issues/3716) masih terbuka). Akibatnya, di
build **Mac App Store** (yang wajib sandbox), folder vault pilihan user **tidak bisa diakses
lagi setelah app ditutup dan dibuka ulang** — user harus memilih ulang foldernya tiap kali.
Itu mematikan model "datamu, foldermu".

Electron mendukung ini **secara native**. Spike ini membuktikannya — atau menggugurkannya.

**Satu pertanyaan yang harus dijawab spike ini:**

> Di build **sandbox**, apakah app bisa **tetap membaca folder pilihan user setelah quit &
> relaunch**, **tanpa** user memilih ulang folder?

Kalau **PASS** → Electron bisa mempertahankan fitur folder **dan** masuk App Store.
Kalau **FAIL** → kembali ke opsi lain (lihat `invois-app/docs/distribution-and-storage-decision.md`).

---

## Cara kerjanya (3 baris kunci)

1. `dialog.showOpenDialog({ securityScopedBookmarks: true })` → macOS mengembalikan
   **bookmark base64** untuk folder yang dipilih user.
2. Bookmark disimpan di `userData` app (selalu boleh ditulis, tanpa izin apa pun).
3. **Setiap launch**: `app.startAccessingSecurityScopedResource(bookmark)` → pintu sandbox
   ke folder itu terbuka lagi → `fs` Node biasa langsung jalan. Saat quit, `stop()` dipanggil
   (wajib — kalau lupa, macOS membocorkan kernel resource dan app kehilangan akses keluar sandbox).

Semua ada di `electron/main.js` (± 150 baris, berkomentar).

---

## Prasyarat

- **Apple Developer Program ($99/th)** — dibutuhkan untuk sertifikat **Mac Development** +
  **provisioning profile development**. Build sandbox tidak bisa ditandatangani tanpanya.
  (Catatan: $99 ini dibutuhkan di jalur rilis mana pun, jadi tidak terbuang.)
- Node + npm.

---

## Menjalankan

```bash
cd invois-macos
npm install
```

### 1. Cek cepat (TIDAK sandbox — tidak membuktikan apa pun)

```bash
npm start
```

Ini menjalankan app tanpa sandbox. Akses folder **selalu** berhasil di sini, jadi hasilnya
**tidak berarti**. UI-nya akan memberi tahu hal ini. Gunanya cuma memastikan app-nya hidup.

### 2. Uji yang sesungguhnya (SANDBOX)

1. Di Apple Developer portal: daftarkan App ID **`app.invois`**, buat **Mac Development
   certificate**, lalu buat **provisioning profile development** untuk App ID itu.
2. Unduh profile-nya, taruh di: **`build/dev.provisionprofile`**
3. Build:

   ```bash
   npm run pack:mas-dev
   ```

4. Jalankan app hasil build (di `dist/mas-dev/Invois.app`) — **bukan** `npm start`.

### 3. Protokol uji (ikuti persis)

| # | Aksi | Yang diharapkan |
|---|------|-----------------|
| 1 | Buka app hasil `mas-dev` | Baris **"Build is sandboxed (MAS)"** harus **yes**. Kalau **no**, kamu menjalankan build yang salah. |
| 2 | Klik **"1 · Choose folder…"**, pilih folder **di luar container** (mis. `~/Documents/InvoisTest`) | "Bookmark stored" → **yes** |
| 3 | Klik **"2 · Write test file"** | File `invois-data.json` tertulis di folder itu |
| 4 | **Quit total dengan ⌘Q** (bukan sekadar tutup window) | — |
| 5 | **Buka lagi app-nya** | ⬅ **INI UJINYA.** Tanpa menyentuh apa pun: "Sandbox access active" = **yes**, "Can read vault file" = **yes**, dan kotak verdict berwarna **hijau: PASS**. |
| 6 | Klik **"3 · Read test file"** | Isi file muncul — **tanpa memilih ulang folder** |

**PASS** = langkah 5 hijau. **FAIL** = "Bookmark stored: yes" tapi "Can read: no" → sandbox
menolak; cek entitlements & signing.

### 4. Ukur ukuran app (untuk perbandingan)

```bash
npm run pack:mac   # build biasa
npm run size
```

Bandingkan dengan `.app` dari Tauri (`invois-app/src-tauri/target/release/bundle/macos/Invois.app`).
Perkiraan: Electron **~120–200 MB** vs Tauri **~10–20 MB**. Ini harga yang dibayar.

---

## Kalau PASS — apa berikutnya

Spike ini **belum** memuat UI Invois. Migrasi penuh berikutnya:

- Port frontend Next.js dari `invois-app/src/` (komponen, store, i18n, template, gating Pro —
  semuanya bisa dipakai ulang apa adanya).
- Ganti pemanggilan Tauri (± 7–8 file) dengan IPC Electron:
  `plugin-fs` → Node `fs` · `plugin-dialog` → `dialog` · `plugin-opener` → `shell.openPath` ·
  `api/path` → `app.getPath()` · menu Rust → `Menu` API ·
  **PDF: `render_pdf_slice` (Rust) → `webContents.printToPDF()` bawaan**.
- Tambah `inAppPurchase` (StoreKit, modul bawaan Electron).

Bonus: quirk WKWebView hilang (bug `Intl` bulan, offset html2canvas, `drawsBackground`
private-API, black flash saat maximize) — karena mesinnya Chromium.

## Kalau FAIL

Catat pesan errornya, lalu tinjau ulang keputusan di
`invois-app/docs/distribution-and-storage-decision.md` (opsi A / B / C).
