# Data disimpan di mana: folder pilihan user, atau app yang atur sendiri?

*Analisis dampak, 14 Juli 2026. Belum diputuskan. Semua angka di sini hasil baca kode dan hitung
baris, bukan kira-kira.*

---

## Yang tidak bisa dilakukan sama sekali

**Simpan data di dalam file `.app`-nya.** Ini bukan ide yang kurang bagus — ini memang tidak bisa:

- Kalau app menulis sesuatu ke dalam dirinya sendiri, **tanda tangan digitalnya rusak**, dan macOS
  akan menolak menjalankan app-nya ([TN2206](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)).
- Kalau lewat App Store, app memang tidak diberi izin menulis ke dirinya sendiri.
- Dan yang paling parah: **setiap update mengganti seluruh isi `.app`.** Jadi tiap kali user update
  Invois, semua invoice-nya hilang. Ini bukan risiko, ini pasti terjadi.

Yang sebenarnya kamu maksud — dan ini yang masuk akal — adalah menyimpan datanya di
**`~/Library/Application Support/Invois/`**, folder standar yang memang disediakan macOS untuk data
aplikasi. Sisa dokumen ini membahas itu.

---

## Kenapa idenya bagus

Kalau dilihat lagi, hampir semua masalah kita dua sesi terakhir sumbernya cuma satu:
**user boleh memilih foldernya sendiri.**

| Masalah | Kenapa bisa terjadi |
|---|---|
| 6.4 — folder Exports tidak ikut pindah waktu vault dipindah | karena vault bisa dipindah |
| 8.3 — onboarding mau menerima folder yang isinya vault lain | karena user bisa menunjuk folder apa saja |
| 8.3 lagi — penjaganya menolak tapi diam saja | karena jalur folder punya banyak cara untuk gagal |
| 10.4 — folder vault hilang waktu app lagi jalan | karena user bisa memindahkannya |
| Vault-mu rusak 13 Juli | karena folder default-nya kena sync iCloud |
| **Tes bookmark App Store — blocker rilis terakhir, kekunci di balik biaya $99** | **bookmark cuma diperlukan kalau folder dipilih user** |

Ada satu baris komentar di `electron/main.js:61` yang bunyinya: *"Security-scoped bookmarks — the
whole reason we're on Electron."* Jadi alasan utama kita pilih Electron daripada Tauri adalah untuk
mendukung fitur yang sekarang mau kita buang. Bukan berarti Electron-nya salah — dia sudah terbukti
jalan di produksi dan tetap dipakai. Tapi kamu perlu tahu ini.

---

## Kode yang bisa dihapus

### `src/lib/data-store.ts` (991 baris)

| Fungsi | Baris | Jadi apa |
|---|---|---|
| `suggestVaultDir` | 8 | **dihapus** |
| `isDirInsideVault` | 12 | **dihapus** |
| `dirContainsVault` | 12 | **dihapus** |
| `readVaultKey` | 12 | **dihapus** (dipakai buat ngintip vault lama waktu onboarding) |
| `recoverVaultLocation` | 20 | **dihapus** |
| `peekExportDirRelocation` | 9 | **dihapus** |
| `clearExportDirRelocation` | 7 | **dihapus** |
| `completeOnboarding` | 35 | tinggal ±5 baris (tidak ada folder, tidak ada pengecekan) |
| `addVault` | 38 | tinggal ±10 baris (jadi "bikin vault", bukan "tunjuk folder") |
| `ensureDefaultExportDir` | 11 | **artinya berubah** — lihat catatan di bawah |

Totalnya: **±110 baris hilang, ±60 baris menyusut banyak.** Semuanya di file yang paling rawan di app.

### `electron/main.js`

Semua kode security-scoped bookmark — `loadBookmarks`, `saveBookmarks`, `openScope`,
`closeAllScopes`, plus pembuatan bookmark waktu user pilih folder — **±60 baris, hilang semua.**
Dan ini bagian app yang **sampai sekarang belum pernah bisa kita tes**, karena butuh akun Apple
Developer yang berbayar.

### Tampilan

- `vault-missing-view.tsx` (135 baris) — **hilang.** Folder tidak mungkin hilang kalau app yang
  pegang. (Sisakan pengecekan tipis saja, karena user masih bisa menghapusnya manual.)
- `onboarding-view.tsx` (465 baris) — **langkah 1 (pilih folder) hilang**, sekitar 150 baris.
  Langkah isi profil bisnis tetap ada. Jadi onboarding tinggal satu langkah.
- `settings-view.tsx` — bagian "Data folder / Relocate" hilang. Bagian "Vaults" tinggal bikin,
  ganti nama, hapus.

### Tes

- `data-store.adopt.test.ts` — **11 dari 14 tes tidak relevan lagi.** Yang tersisa cuma dua tes
  backup harian.
- `data-store.format.test.ts` (16 tes) dan `data-store.test.ts` (5 tes) — isinya masih relevan, tapi
  persiapannya pakai `completeOnboarding(dir)`, jadi harus disesuaikan.
- `format`, `money`, `vault-migrate`, `persist`, `view`, `i18n` — **tidak terpengaruh sama sekali**
  (66 tes).

### Dokumen QA — 9 dari 43 kasus

| Kasus | Jadi apa |
|---|---|
| 1.1 Onboarding vault baru | ditulis ulang (tidak ada langkah pilih folder) |
| 4.4 Folder ekspor memulihkan diri | ditulis ulang (ekspor tidak lagi di dalam vault) |
| 6.1 Menambah bisnis kedua | ditulis ulang (tidak ada folder picker) |
| 6.3 Hapus bisnis tidak menghapus file | ditulis ulang |
| 6.4 Memindahkan vault | **dihapus** |
| 8.1 Siapkan sumber yang bisa dibedakan | **dihapus** |
| 8.2 Adopsi vault waktu install ulang | **dihapus** |
| 8.3 Tolak folder di dalam vault lain | **dihapus** |
| 10.4 Folder vault hilang waktu app jalan | tinggal pengecekan tipis |

### Teks

Ada 48 teks i18n (`ob.*`, `vm.*`, `set.vault*`, `set.data*`) yang sebagian besar tidak dipakai lagi.

Panel kiri onboarding yang bilang *"Your data stays on your Mac"* **masih benar** dan tetap dipakai.
Yang harus ditulis ulang: isi langkah 1, dan **klaim "folder pilihanmu" di landing page**
(`invois-landing/`). Ingat, hero landing page-nya sudah kamu kunci — jadi ini menyentuh yang sudah
final.

---

## Apa yang hilang buat user

**Bukan janji "datamu ada di Mac-mu".** Itu tetap utuh. Datanya tetap satu file JSON di komputernya,
tetap bisa dibuka, tetap tidak dikirim ke mana-mana. Yang hilang bukan janjinya, tapi **caranya**:
user tidak lagi memilih sendiri di folder mana.

Yang benar-benar hilang cuma satu: **taruh vault di Dropbox biar sync sendiri.** Tapi ingat, folder
yang kena sync iCloud itu justru yang bikin vault-mu rusak 13 Juli kemarin. Jadi aku ragu ini
kehilangan.

Yang berkurang: **datanya jadi tidak kelihatan.** Folder `~/Library` disembunyikan Finder. User yang
hapus app-nya akan mengira datanya ikut hilang (padahal tidak). Dan user yang mau membuktikan sendiri
kalau "datanya memang miliknya" jadi tidak bisa langsung lihat. **Ini harus dibayar, tidak boleh
didiamkan** — lihat bagian berikutnya.

---

## Yang harus kita bikin sebagai gantinya

**1. Tombol backup yang kamu usulkan itu — tapi jangan dinamai "Backup".**

Tombol yang harus diingat user untuk ditekan itu sama saja dengan tidak ada backup. Orang menekannya
sekali di minggu pertama, habis itu lupa. Yang benar-benar menjaga data mereka tetap backup otomatis
yang sudah ada sekarang (`.bak1..3` tiap simpan + snapshot harian 14 hari di `Backups/`), dan itu
**wajib tetap jalan**.

Yang kita butuh sebenarnya tiga tombol:

- **Ekspor salinan…** — buka panel simpan macOS, hasilnya file bertanggal
  (`invois-2026-07-14.json`). Ini yang kamu maksud, dan memang bagus.
- **Buka folder data di Finder** — biar user bisa **lihat sendiri** datanya, bukan cuma dengar
  janji.
- **Impor dari file…** — kebalikannya. Kalau cuma bisa ekspor tanpa bisa impor, itu namanya pintu
  keluar tanpa pintu masuk. Bukan portabilitas, cuma kelihatannya saja.

**2. Jebakan yang gampang kelewat: Developer-ID dan App Store simpan di tempat BERBEDA.**

- Developer-ID: `~/Library/Application Support/Invois/`
- App Store: `~/Library/Containers/app.invois/Data/Library/Application Support/Invois/`

Kalau kamu pernah rilis lewat satu jalur lalu pindah ke jalur lain, **user yang sama akan punya dua
lokasi data**, dan yang lama kelihatannya hilang. Jadi ini harus diputuskan **sekarang**, sebelum
build pertama keluar: pilih satu jalur rilis, atau bikin migrasi antar-jalur dulu.

---

## Migrasi user lama (termasuk kamu — 789 invoice asli)

Aturannya cuma satu, dan lahir dari kejadian 13 Juli:
**JANGAN PERNAH MEMINDAHKAN FILE ASLINYA. SALIN SAJA.**

Waktu build baru dibuka dan ternyata `invois_vault_config` masih menunjuk ke folder pilihan user:

1. **Salin** `invois-data.json` beserta folder `Backups/` ke lokasi baru. File aslinya **jangan
   disentuh, jangan dihapus, jangan dipindah.**
2. Tandai di config kalau migrasi sudah jalan. Harus aman kalau diulang — misalnya app crash di
   tengah jalan, jangan sampai nyalin dua kali atau menimpa yang sudah ada.
3. Kasih pemberitahuan sekali: *"Datamu sekarang disimpan di sini. Salinan lamamu di `<folder>` masih
   utuh, silakan hapus sendiri kalau sudah yakin."*
4. Kalau di lokasi baru **ternyata sudah ada** vault, **jangan ditimpa.** Berhenti, dan tanya dulu.

Konsekuensinya: user yang buka build **lama** setelah migrasi akan melihat vault lamanya yang
ketinggalan di folder lama, dan lama-lama dua salinan itu bisa beda isi. Itu harga dari prinsip
"jangan pernah hapus data orang", dan menurutku harga itu pantas.

---

## Rekomendasiku

**Ambil.** Untuk v1: **biar app yang atur lokasinya.**

Alasannya: ini menghapus **blocker rilis terakhirmu** (tes bookmark App Store yang kekunci di balik
biaya $99), membuang **±170 baris di file paling rawan di app**, dan menghilangkan **satu kelas bug
sekaligus** — bukan dengan menambal satu-satu, tapi dengan menghapus penyebabnya.

Dan yang penting: **keputusan ini gampang dibalik.** Kalau nanti mau menambahkan "pilih foldermu
sendiri", tinggal salin file ke folder pilihan user. Sebaliknya jauh lebih susah: kalau vault sudah
tersebar di folder-folder user, menariknya kembali itu berat. **Kerjakan dulu yang gampang dibalik.**

Tapi ada dua syarat, dan aku tidak setuju kalau salah satunya tidak ada:

1. **Ekspor + Impor + Buka di Finder harus ikut rilis yang sama.** Kalau kita ambil folder pilihan
   user, kita punya utang: buktikan datanya tetap milik dia. Tanpa tiga tombol itu, ini bukan
   penyederhanaan, tapi mengurung data user.
2. **Tentukan satu jalur rilis sekarang** (Developer-ID atau App Store), atau bikin migrasi
   antar-jalur sebelum build pertama keluar.

---

## Kalau kamu tidak setuju

Ada jalan tengah: **lokasi default diatur app, tapi ada opsi "pindahkan folder data…" di Settings
untuk yang mau.** User baru tidak pernah lihat folder picker; yang mau Dropbox tetap bisa.

Tapi ketahui harganya: **hampir semua keuntungan di atas hilang.** Kode bookmark tetap harus ada,
tetap harus dites, tetap kekunci di balik biaya $99. `recoverVaultLocation`, `isDirInsideVault`,
`dirContainsVault`, `VaultMissingView` — semuanya tetap hidup. Cukup satu user saja yang pakai opsi
itu, semua jalur tadi jadi wajib benar.

Jadi jalan tengah ini membeli **onboarding yang lebih enak**, bukan **kode yang lebih sederhana**.
Itu tetap hasil yang sah — asal kamu tidak mengira sedang dapat yang kedua.
