# Rencana port Electron → Tauri (jujur, tanpa menakut-nakuti)

*14 Juli 2026. Ini rencana kerja yang benar-benar bisa dijalankan, bukan argumen. Angka waktu di sini
dekomposisi jujur — apa yang aku kerjakan cepat, apa yang digerbangi Mac-mu, dan apa yang tidak bisa
dipercepat siapa pun.*

---

## Fakta pembuka: kita tidak mulai dari nol

Repo `invois-app` (Tauri) yang parkir **sudah punya** pondasi native-nya:

| Sudah ada di Tauri | Bentuknya |
|---|---|
| fs (baca/tulis/rename/mkdir/remove) | `@tauri-apps/plugin-fs` |
| dialog (pilih folder/file) | `@tauri-apps/plugin-dialog` |
| buka path/URL | `@tauri-apps/plugin-opener` |
| path (home/documents) | `@tauri-apps/api/path` |
| PDF vektor | `render_pdf_slice` (Rust, `WKWebView.createPDF`) |
| menu native + pintasan | `build_menu` (Rust) |
| atomic rename | sudah dicatat: *"std::fs::rename overwrites atomically on macOS/Unix"* |

Yang **basi**: semua logika di ATAS native itu. Repo Tauri belum punya kerja beberapa minggu terakhir —
uang integer, safe mode, `vault-read`, rotasi backup dengan salin, migrasi format 3, banner
`useSyncExternalStore`. `data-store.ts`-nya menyimpang 402 baris, dan `money.ts`/`vault-migrate.ts`/
`vault-read.ts` belum ada sama sekali.

Jadi ini bukan "menulis app Tauri". Ini **membawa logika terkini ke pondasi Tauri yang sudah berdiri.**

---

## Strategi inti: satu seam, jangan fork

Ini kunci yang membuat port ini masuk akal, bukan mimpi.

Di Electron, **satu file** `src/lib/native.ts` mendefinisikan seluruh permukaan native (fs, dialog,
path, opener, pdf, win, menu). Semua kode di atasnya — `data-store.ts` dan seterusnya — cuma memanggil
`native.*`, tidak pernah tahu Electron itu apa.

**Maka: tulis satu `native.ts` versi Tauri, dan biarkan `data-store.ts` + semua di atasnya IDENTIK
antara dua build.** Itu efisiensinya, dan itu nyata.

Menariknya, `native.ts` versi Tauri justru **lebih sederhana** daripada versi Electron:

- Electron: `native.ts` → `window.invois` (preload) → `ipcMain.handle` → `node:fs`. Tiga lapis.
- Tauri: `native.ts` → `plugin-fs` langsung. Plugin Tauri bisa dipanggil dari webview tanpa bridge.

Jadi seluruh `electron/preload.js` (72 baris) dan 15 handler `ipcMain` di `main.js` **tidak punya
padanan** — mereka menguap, bukan diport.

> Repo Tauri yang sekarang memanggil `plugin-fs` **langsung di dalam `data-store.ts`** (`await import
> ("@tauri-apps/plugin-fs")` tersebar di banyak tempat). Itu justru yang HARUS diubah: alihkan lewat
> `native.ts` juga, supaya `data-store.ts` sama persis dengan yang di Electron. Menyatukan seam-nya
> adalah langkah pertama yang membuat sisanya gampang.

---

## Fase, dengan pembagian kerja yang jujur

Notasi: **[aku]** = bisa kutulis cepat. **[loop]** = aku tulis, tapi harus kamu compile/jalankan di
Mac, bolak-balik. **[kamu]** = cuma tangan manusia yang bisa.

### Fase 0 — Prasyarat (keputusan, bukan kode)

- **Terima PDF untagged.** Sudah terbukti byte-nya: Tauri vektor + teks bisa di-copy, tapi tidak
  tagged. Kalau ini oke buatmu, lanjut. Kalau tidak, berhenti di sini — ini satu-satunya beda PDF yang
  nyata dan tidak bisa diperbaiki di Tauri.
- **Path vault di sandbox.** Konfirmasi `appLocalDataDir()` Tauri mengarah ke container MAS
  (`~/Library/Containers/app.invois/...`). **[loop]** — perlu build sandbox untuk memastikan.
- Ini sejalan dengan keputusan v1 (App Store + vault dikelola app), jadi tidak ada kerja folder-picker.

### Fase 1 — Bawa logika bersama ke Tauri **[aku]**, verifikasi **[kamu: `npm run verify`]**

Salin/gabung dari Electron ke `invois-app`: `money.ts`, `vault-migrate.ts`, `vault-read.ts`,
`format.ts`, `persist.ts`, `view.ts`, `store.tsx`, dan bagian `data-store.ts` yang bukan native
(safe mode, rotasi, migrasi format). Plus semua tes.

Risiko: **rendah.** Ini framework-agnostik; kalau `tsc` + 104 tes hijau, dia benar. Aku bisa kerjakan
ini dalam hitungan jam. Kamu tinggal jalankan `npm run verify` sekali.

### Fase 2 — Tulis `native.ts` versi Tauri **[aku tulis] → [loop]**

Petakan tiap fungsi `native.*` ke plugin Tauri:

| `native.*` | Tauri |
|---|---|
| `fs.exists/readText/writeText/mkdir/remove/rename` | `plugin-fs` |
| `fs.readDirs` (baru sesi ini) | `plugin-fs` `readDir` |
| `fs.writeBinary` (PNG) | `plugin-fs` `writeFile` (Uint8Array) |
| `dialog.pickDirectory` | `plugin-dialog` `open({directory:true})` |
| `path.home/documents/downloads` | `@tauri-apps/api/path` |
| `opener.openPath` | `plugin-opener` |
| `pdf.toFile` | panggil `render_pdf_slice` + gabung (sudah ada di repo) |
| `win/menu` | event dari `build_menu` Rust (sudah ada) |

Risiko: **sedang.** Kodenya lugas, tapi aku tidak bisa menjalankannya. Tiap ketidakcocokan (bentuk
argumen plugin, permission capability) ketahuan hanya saat kamu compile + jalankan. Ini **[loop]** yang
sesungguhnya: aku tulis → kamu build → error/berhasil → kita sesuaikan.

### Fase 3 — Capability & sandbox MAS **[loop]**

Tauri butuh file *capability* yang memberi izin fs ke folder container, dialog, opener. Beda mekanisme
dari entitlement Electron, dan cuma bisa diuji di build sandbox nyata.

### Fase 4 — PDF disamakan dengan template terkini **[loop]**

`render_pdf_slice` sudah ada, tapi ditulis untuk template versi lama. Pastikan dia mencetak template
sekarang (6 template, print mode, paginasi slice). Terima untagged. Uji lintas-halaman.

### Fase 5 — Ulang QA native **[kamu, tidak bisa dipercepat]**

~32 kasus yang menyentuh native: onboarding, simpan/ekspor, backup, safe mode, vault rusak, format
masa depan, jendela/menu, build terpaket. 9 kasus logika murni (uang) **tidak** perlu diulang — sudah
dijamin tes unit.

Ini bagian yang **tidak bisa aku sentuh sama sekali.** Hanya kamu yang bisa mengklik, mengekspor,
merusak vault, meminimalkan jendela. Dan di sinilah bug native baru akan muncul — jenis yang cuma
ketahuan saat app jalan, bukan di tes.

---

## Berapa lama, jujur

| Fase | Siapa | Perkiraan |
|---|---|---|
| 1 — logika bersama | aku, kamu verify | beberapa jam kerjaku + 1× `npm run verify` |
| 2 — native.ts Tauri | aku tulis, loop | 1 sesi nulis + beberapa putaran compile denganmu |
| 3 — capability MAS | loop | tergantung seberapa rewel sandbox; ½–1 hari |
| 4 — PDF | loop | ½ hari kalau `render_pdf_slice` masih waras |
| 5 — QA 32 kasus | **kamu** | tidak bisa dikompres; realistis 1–2 hari fokus, tangan manusia |

**Bukan "seminggu ngoding olehku."** Penulisan kodeku mungkin 1–2 hari efektif. Yang mengikat kalender
adalah **loop compile-Rust di Mac-mu** dan **QA manual yang cuma bisa tanganmu** — dua-duanya tidak
peduli seberapa cepat aku menulis.

---

## Kapan berhenti dan balik ke Electron (kill criteria)

Supaya ini tidak jadi lubang tanpa dasar, sepakati batas di depan:

- **Fase 2/3 macet karena WKWebView/sandbox** lebih dari ~2 hari loop tanpa kemajuan → balik. Bridge
  yang melawan di awal biasanya melawan terus.
- **Ada kasus QA keselamatan-data yang gagal** (safe mode tidak menahan, atomic write bocor, backup
  tidak terbentuk) **dan** perbaikannya tidak bersih → balik. Ini layer yang tidak boleh kompromi.
- **PDF paginasi slice pecah** di invoice panjang dan tidak terselesaikan dalam ½ hari → balik.

Balik ke Electron itu **gratis** — dia sudah selesai dan ter-QA. Itu jaring pengamanmu selama port,
dan itu alasan kenapa mencoba Tauri sekarang tidak sembrono: kamu punya retret yang terbukti.

---

## Yang TIDAK berubah, apa pun hasilnya

Uang integer, safe mode, migrasi, gerbang Pro, i18n, template, keputusan vault-di-`~/Library`. Semua
itu di lapisan yang framework-agnostik. Port ini menukar **pondasi**, bukan produk.

---

## Rekomendasi jujur tentang cara menjalankannya

Kalau kamu memutuskan mencoba: **jangan sentuh `invois-macos`.** Kerjakan di `invois-app`, di branch
sendiri. Biarkan Electron tetap jadi build yang siap kirim sampai Tauri lolos QA yang sama. Baru kalau
Tauri hijau penuh di 32 kasus itu, kita bandingkan apple-to-apple dan kamu putuskan mana yang dikirim.

Dengan begitu kamu tidak pernah bertaruh pada satu kuda. Kamu punya dua build sampai salah satunya
jelas menang — dan keputusannya berdasar bukti, bukan tebakan.
