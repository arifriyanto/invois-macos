# Rencana: rilis v1 tanpa "pilih folder", tapi fiturnya tetap siap dipakai

*14 Juli 2026. Lanjutan dari `vault-location-decision.md`.*

Tujuannya: v1 pakai lokasi yang diatur app, tapi kode "pilih folder sendiri" **tidak dibuang** dan
nanti bisa dinyalakan tanpa nulis ulang banyak hal.

---

## Jebakan yang harus dihindari duluan

**Kode yang tidak pernah dijalankan itu kode yang sudah rusak, cuma belum ketahuan.**

Kalau kita cuma bungkus fitur folder pakai `if (FLAG)` lalu tidak pernah menyentuhnya lagi, enam
bulan kemudian dia sudah tidak jalan: React berubah, API berubah, ada yang refactor `data-store`
tanpa sadar merusak jalur yang tidak pernah dia lihat. Waktu mau dinyalakan, kita tetap harus nulis
ulang — tapi sekarang sambil membongkar kode yang sudah membusuk. Itu lebih buruk daripada menghapus
bersih.

Jadi syaratnya: apa pun yang kita simpan harus tetap **ikut dikompilasi**, tetap **ikut dites**, dan
tetap **bisa dijalankan**.

Kabar bagusnya: **tes kita sudah memalsukan filesystem.** Lihat `data-store.format.test.ts` — dia
pakai `Map` sebagai file system (`files.set("/v/bad/invois-data.json", ...)`). Artinya seluruh jalur
"pilih folder" bisa tetap dites 100% walaupun **tidak ada satu pun user yang bisa mencapainya**.
Satu-satunya yang tetap tidak bisa dites cuma bookmark macOS — dan itu memang sudah tidak bisa dites
dari dulu.

---

## Yang mahal diubah nanti bukan kodenya

Kode gampang diubah kapan saja. Yang susah dua ini:

**1. Bentuk config yang sudah tersimpan di komputer user.**

Sekarang bentuknya begini:

```ts
interface VaultEntry {
  id: string;
  name: string;
  dir: string;   // path folder absolut
}
```

Kalau v1 rilis dengan bentuk ini apa adanya, lalu v2 mau menambah "vault ini dipilih user, yang itu
diatur app", kita harus bikin **migrasi config di komputer ribuan orang** — dan migrasi itu jalan di
saat app baru buka, sebelum apa pun sempat divalidasi. Itu tepat jenis pekerjaan yang bikin vault-mu
rusak 13 Juli.

Ubah sekarang, mumpung penggunanya baru kamu sendiri:

```ts
type VaultKind = "app" | "user";

interface VaultEntry {
  id: string;
  name: string;
  kind: VaultKind;   // ← tambahkan SEKARANG, walau v1 cuma pernah nulis "app"
  dir: string;       // "app": diisi app; "user": dipilih user
}
```

Config lama (`kind` tidak ada) dibaca sebagai `"user"` — karena memang itulah yang selama ini terjadi.
Satu baris, dan migrasi config di masa depan tidak pernah perlu ditulis.

**Ini bagian paling penting di seluruh dokumen ini.** Sisanya bisa diperbaiki kapan saja.

**2. Entitlement yang sudah diajukan ke Apple.**

v1 **jangan** minta `com.apple.security.files.user-selected.read-write`. Tanpa entitlement itu, review
App Store lebih sederhana, dan kode bookmark yang ikut terbawa di binary tidak bisa apa-apa (mati
suri, bukan bahaya). Waktu v2 menyalakan fitur folder, entitlement itu ditambahkan dan app masuk
review lagi — itu wajar dan memang begitu prosesnya.

---

## Caranya: satu sambungan, bukan flag bertebaran

Sekarang, urusan lokasi tersebar di mana-mana: onboarding, settings, `data-store`, `main.js`. Kalau
kita bungkus semuanya pakai `if (FLAG)`, flag-nya akan ada di sepuluh tempat dan salah satunya pasti
kelupaan.

Gantinya: **kumpulkan jadi satu antarmuka**, lalu v1 dan v2 cuma beda di implementasi mana yang
dipasang.

```ts
// src/lib/vault-location.ts  (baru)

export interface VaultLocation {
  kind: VaultKind;

  /** Folder tempat vault ini tinggal. */
  resolveDir(entry: VaultEntry): Promise<string>;

  /** Bikin vault baru. "app" → bikin folder sendiri, tidak nanya.
   *  "user" → buka folder picker, validasi, minta bookmark. */
  create(name: string): Promise<VaultEntry>;

  /** Bisa dipindah user? "app" → false. "user" → true. */
  readonly relocatable: boolean;

  /** Foldernya hilang — bisa dicari ulang? "app" → false (bikin baru saja).
   *  "user" → true (VaultMissingView). */
  recover?(entry: VaultEntry): Promise<boolean>;
}

export const appManaged: VaultLocation = { /* v1 */ };
export const userChosen: VaultLocation = { /* v2 — TETAP DIKOMPILASI & DITES */ };

/** Satu-satunya tempat yang menentukan mana yang dipakai. */
export function locationFor(entry: VaultEntry): VaultLocation {
  return entry.kind === "user" ? userChosen : appManaged;
}

/** Yang dipakai saat bikin vault BARU. Ini satu-satunya "flag" di seluruh app. */
export const NEW_VAULT_LOCATION: VaultLocation = appManaged;
```

Setelah ini, menyalakan fitur folder di v2 = mengganti `NEW_VAULT_LOCATION` dan menampilkan lagi
tombol picker-nya. Bukan menulis ulang.

Yang pindah ke `userChosen` (dan **tetap dites**): `isDirInsideVault`, `dirContainsVault`,
`suggestVaultDir`, `recoverVaultLocation`, `readVaultKey`, dan bagian `addVault`/`completeOnboarding`
yang berurusan dengan folder picker.

---

## Supaya tidak membusuk: tiga aturan

**1. Tetap dikompilasi.** `userChosen` diekspor dan dipakai `locationFor()`, jadi `tsc` melihatnya.
Bukan file yatim yang cuma nangkring di folder.

**2. Tetap dites, dan tesnya jalan tiap commit.** Semua tes `data-store.adopt.test.ts` yang tadi kita
kira "gugur" — **jangan dihapus.** Tulis ulang setup-nya supaya bikin `VaultEntry` dengan
`kind: "user"`, lalu biarkan jalan seperti biasa. Filesystem-nya sudah palsu, jadi tidak butuh folder
sungguhan. **Ini yang bikin fitur folder tetap hidup meski tidak ada user yang memakainya.**

**3. Tetap bisa dijalankan.** Tambah saklar khusus dev — sama seperti saklar Pro yang sudah ada — biar
kamu bisa menjalankan app dalam mode "pilih folder" kapan pun. Kode yang tidak pernah kamu **lihat
jalan** adalah kode yang tidak kamu percayai lagi enam bulan lagi.

Dan konsekuensi yang jujur: **tanpa CI, aturan 2 cuma janji.** Ini alasan tambahan buat pasang CI —
kalau fitur yang tidak dipakai siapa pun mau tetap sehat, satu-satunya penjaganya adalah tes yang
jalan otomatis di tiap push.

---

## Yang tidak bisa diselamatkan dengan flag

Beberapa hal harus **diputuskan**, bukan disimpan untuk nanti:

**Folder ekspor.** Sekarang default-nya `<vault>/Exports`. Di v1 vault-nya tersembunyi di
`~/Library`, jadi ekspor **tidak boleh** ke situ — user tidak akan menemukan PDF-nya. Harus pindah ke
tempat yang kelihatan (`~/Documents/Invois/` atau `~/Downloads`). Ini keputusan permanen, bukan flag,
karena user sudah terlanjur punya file di sana.

**Onboarding.** Langkah "pilih folder" jangan dihapus komponennya — sembunyikan saja, dan biarkan
saklar dev bisa memunculkannya lagi. Tapi **alur satu-langkah harus dirancang beneran**, bukan sekadar
langkah 2 yang ditinggal sendirian.

**Teks & landing page.** Klaim "folder pilihanmu" harus dicabut sekarang. Kalau v2 mengembalikan
fiturnya, teksnya ditambahkan lagi. Menjanjikan fitur yang tidak ada di app itu lebih buruk daripada
tidak menjanjikan apa-apa.

---

## Urutan kerjanya

| # | Pekerjaan | Kenapa urutannya begini |
|---|---|---|
| 1 | Tambah `kind` di `VaultEntry` + baca config lama sebagai `"user"` | **Paling mendesak.** Kalau v1 rilis tanpa ini, migrasi config nanti jadi wajib |
| 2 | Bikin `vault-location.ts`, pindahkan kode folder ke `userChosen` | Sambungannya. Setelah ini semuanya jadi gampang |
| 3 | Bikin `appManaged` + migrasi vault lama (SALIN, jangan pindah) | Fitur v1-nya sendiri |
| 4 | Pindahkan default folder ekspor keluar dari vault | Keputusan permanen, harus sebelum rilis |
| 5 | Tulis ulang setup tes `adopt` pakai `kind: "user"` — **jangan hapus tesnya** | Ini yang menjaga fitur folder tetap hidup |
| 6 | Saklar dev untuk menjalankan mode "pilih folder" | Supaya kamu bisa lihat sendiri dia masih jalan |
| 7 | Tiga tombol: Ekspor salinan, Impor, Buka di Finder | Utang ke user, wajib ikut rilis yang sama |
| 8 | Pasang CI | Tanpa ini, poin 5 cuma janji |

Langkah 1 dan 2 yang benar-benar menentukan. Sisanya bisa dikerjakan pelan-pelan.

---

## Harga yang harus kamu tahu

Cara ini **lebih banyak kerjanya** daripada menghapus bersih. Kita menyimpan `userChosen` beserta
tesnya, jadi `data-store.ts` tidak jadi mengecil banyak — cuma dirapikan. Yang benar-benar hilang
tinggal kode bookmark di `main.js`... dan itu pun sebenarnya **tetap disimpan**, cuma tidak
dipanggil.

Jadi jujurnya: kamu **tidak** dapat "±170 baris hilang" seperti di dokumen sebelumnya. Yang kamu dapat:

- **Blocker rilis hilang** — tanpa entitlement folder, tes bookmark App Store tidak lagi menghalangi
  rilis. Ini yang paling berharga, dan ini tetap dapat.
- **Seluruh kelas bug hilang buat user v1** — tidak ada folder yang bisa dipindah, dihapus, atau
  disarangkan.
- **Fitur folder tetap utuh dan tetap sehat**, siap dinyalakan kapan pun.

Yang tidak kamu dapat: kode yang lebih sederhana. Itu harga dari menyimpan pilihan terbuka, dan
menurutku sepadan — asal jangan sampai kamu mengira sedang dapat dua-duanya.
