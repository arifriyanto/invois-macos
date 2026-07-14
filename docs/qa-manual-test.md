# Rencana uji teknis — Invois (Electron)

Untuk `invois-macos`, dijalankan dengan `npm run dev`. Terakhir dicocokkan dengan kode: 13 Juli 2026.

> **Ini dokumen internal.** Ia menuntutmu membuka DevTools, mengedit JSON dengan tangan, merusak file
> vault dengan sengaja, dan menjalankan perintah terminal. **Jangan berikan ini kepada penguji awam.**
>
> Untuk mereka ada **[`qa-panduan-penguji.md`](qa-panduan-penguji.md)** — bahasa sehari-hari, tanpa
> terminal, tanpa mengedit file. Isinya seluruh alur yang bisa dijalankan lewat aplikasi saja:
> onboarding, aritmetika uang, batas Free, ekspor, Settings, daftar, dan menu.
>
> Yang **hanya** ada di dokumen ini, karena butuh tangan teknis:
> Fase 8 (adopsi & penjaga sarang), Fase 9 (migrasi format vault), dan Fase 10 (vault rusak, bentuk
> salah, format masa depan, folder hilang, rotasi backup). Itu justru bagian tempat kegagalan paling
> mahal bersembunyi — jadi seseorang tetap harus mengerjakannya. Orang itu kamu.

---

## Catatan uji

Arif menguji dan menyebutkan hasilnya di chat ("1.1 lolos", "2.3 gagal, totalnya jadi …"). Claude yang
mencentang di sini dan meng-commit-nya.

Centang berarti: **lolos pada commit yang tertulis di sebelahnya.** Kalau kode yang mendasarinya
berubah, centangnya dikosongkan lagi — `data-store.ts` mengosongkan Fase 8–10, `money.ts` atau
`format.ts` mengosongkan Fase 2. Bukan birokrasi, cuma jujur bahwa yang dulu terbukti sudah bukan
kode yang sama.

Dokumen ini melengkapi test otomatis, bukan menggantikannya. `npm run verify` sudah menjamin
aritmetika uang, migrasi vault, penomoran, i18n, dan persistensi. Yang **tidak** bisa dijamin unit
test adalah semua yang menyentuh disk sungguhan, jendela sungguhan, dan mesin cetak Chromium — dan
justru di sanalah tiga bug produksi terakhir bersembunyi. Itulah yang diuji di sini.

**Bacalah ini sebagai satu perjalanan, bukan daftar acak.** Fase-fasenya berurutan: tiap fase
memakai keadaan yang ditinggalkan fase sebelumnya. Melompat akan membuatmu terjebak — beberapa uji
mustahil kalau prasyaratnya belum ada, dan uji vault rusak di akhir sengaja meninggalkan app dalam
mode aman, yang membatalkan keabsahan uji apa pun sesudahnya.

Tiap fase dibuka dengan **Keadaan awal** (di mana kamu seharusnya berada) dan ditutup dengan
**Meninggalkan** (apa yang dibawa ke fase berikutnya).

Tiap kasus punya bentuk yang sama: langkah, **yang seharusnya terjadi**, dan — untuk yang berisiko —
**seperti apa kegagalannya**. Bagian terakhir itu penting: bug yang paling merugikan di app ini bukan
yang membuat app crash, tapi yang membuat app tampak baik-baik saja sambil menyimpan angka yang salah.

---

## Fase 0 — Persiapan

**Buat folder kerja yang bisa dibuang.** Jangan pernah menguji pada vault yang datanya kamu sayangkan.

```bash
mkdir -p ~/Desktop/qa/{v-baru,v-adopsi,v-rusak}
```

**Cara mengulang onboarding dari nol.** Pointer ke vault disimpan di localStorage, bukan di dalam
vault. Buka DevTools (⌥⌘I) → Console:

```js
localStorage.removeItem("invois_vault_config");
location.reload();
```

Ini **tidak** menghapus file vault-mu — hanya melupakan lokasinya. Vault lamanya masih di disk dan
bisa diadopsi ulang.

**Tapi perhatikan: reset pointer TIDAK mengembalikanmu ke Free.** App menyimpan lima hal di
localStorage, dan perintah di atas hanya menyentuh satu:

| Kunci | Isinya | Terhapus oleh perintah di atas? |
|---|---|---|
| `invois_vault_config` | lokasi vault (pointer) | **ya** |
| `invois_dev_pro` | status Pro | **tidak** |
| `invois_lang` | bahasa UI | **tidak** |
| `invois_sidebar_collapsed` | sidebar menguncup | **tidak** |
| `invois_exportdir_relocate` | petunjuk sementara saat vault dipindah | **tidak** |

Ini bukan sekadar ketidaknyamanan. Kalau kamu mengulang rencana ini dari atas sementara Pro masih
menyala, **tiga kasus uji jadi tidak bisa gagal**: batas 3 invoice (3.5), pengaman jalur simpan (3.6),
dan gerbang template (3.7) tidak akan pernah terpicu — dan semuanya akan tampak "lolos". Uji yang
tidak bisa gagal lebih buruk daripada tidak ada uji, karena ia memberi rasa aman palsu.

Jadi untuk memulai bersih sebagai pengguna baru yang **Free**:

```js
localStorage.clear();
location.reload();
```

Itu menghapus kelimanya. (Bahasa akan kembali ke English — itu default-nya.)

Perhatikan juga: **bahasa dan status Pro melekat pada mesin, bukan pada vault.** Berpindah bisnis
tidak mengubah keduanya.

**Melihat isi vault.** Selama pengujian, ini teman terbaikmu:

```bash
python3 -m json.tool ~/Desktop/qa/v-baru/invois-data.json | head -40
```

Angka uang di file adalah **bilangan bulat satuan terkecil**: `1999` = $19,99. Untuk IDR, satuan
terkecilnya rupiah itu sendiri, jadi `2500000` = Rp 2.500.000. Kalau kamu melihat titik desimal pada
harga di dalam file, itu bug.

**Toggle Pro** ada di Settings → tab **Dev** (ikon kunci inggris). Tab itu tidak pernah ada di build
produksi (`isDevBuild` menjaganya). Jangan menyalakannya dulu — Fase 1–3 harus dijalani sebagai
pengguna **Free**.

> **Meninggalkan:** tiga folder kosong. App belum tahu apa-apa.

---

## Fase 1 — Pemasangan pertama (Free)

> **Keadaan awal:** tidak ada vault terdaftar, dan **kamu harus Free**.
>
> **Pastikan dulu.** Buka Settings → Dev dan lihat toggle Pro-nya. Kalau menyala, matikan — atau
> mulai bersih dengan `localStorage.clear()`. Reset pointer saja **tidak cukup**: Pro disimpan di
> kunci terpisah dan akan selamat. Kalau Pro menyala di sini, Fase 3.5–3.7 akan "lolos" tanpa pernah
> benar-benar diuji.

### 1.1 Onboarding vault baru

1. Layar onboarding muncul: panel kiri biru dengan ilustrasi, form di kanan.
2. **Langkah 1** — lokasi data. Arahkan ke `~/Desktop/qa/v-baru`.
3. **Langkah 2** — profil bisnis. Field-nya **hanya lima**: logo, nama bisnis, email, telepon, dan
   **mata uang**. Tidak ada alamat di sini (alamat baru muncul di Settings), dan tidak ada pemilih
   bahasa. Pilih mata uang **USD** — sepanjang rencana ini kita pakai USD, karena ia punya sen, dan
   sen itulah yang memperlihatkan apakah aritmetika uangnya benar.
4. Selesaikan.

**Seharusnya:** app mendarat langsung di editor invoice dengan **beacon walkthrough** menyala —
titik berdenyut di Klien → Item → Simpan. File `invois-data.json` muncul di `v-baru`, dengan
`"__invois": { "format": 3 }` di paling atas dan satu klien + satu item katalog berlabel **(Sample)**
(id-nya `sample-client` dan `sample-item`).

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 1.2 Placeholder telepon ikut MATA UANG

Ini bagian pertama dari uji dua-bagian. Bagian keduanya (bahasa) ada di Fase 5 — ia butuh Settings,
dan onboarding tidak punya pemilih bahasa.

Kalau kamu sudah melewati onboarding, ulangi saja: hapus pointer, reload, dan berhentilah di langkah
2. Ganti dropdown **mata uang**, perhatikan placeholder telepon:

| Mata uang | Placeholder |
|---|---|
| IDR | `+62 812 3456 xxxx` |
| USD | `+1 (415) 555-xxxx` |
| SGD | `+65 8123 xxxx` |
| EUR | `+49 30 1234 xxxx` |
| GBP | `+44 7700 900xxx` |

Ekor nomornya harus tetap `x`. Placeholder yang tampak seperti nomor asli bisa jadi **milik orang
sungguhan**, dan ia dipajang di ribuan layar. (GBP memakai 7700 900xxx — rentang yang dicadangkan
Ofcom untuk fiksi, jadi tebakan selengkap apa pun tidak menghubungi siapa-siapa.)

Selesai menguji, kembalilah ke USD dan tuntaskan onboarding ke `v-baru`.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



> **Meninggalkan:** vault `v-baru` aktif, mata uang USD, **Free**, 0 invoice tersimpan, 1 klien
> (Sample), 1 item katalog (Sample). Editor invoice terbuka dengan beacon menyala.

---

## Fase 2 — Invoice pertama: uang, dan hanya uang

> **Keadaan awal:** editor invoice baru, `v-baru`, USD, Free.

Fase ini yang paling penting di seluruh dokumen. **Baca angkanya. Jangan cuma memastikan form-nya
tidak error.**

### 2.1 Qty tidak boleh pecahan

Di kolom **Qty** sebuah baris item:

| Yang kamu lakukan | Yang seharusnya terjadi |
|---|---|
| Tekan `.` atau `,` | **Tidak ada yang terketik.** Ditolak di tombol. |
| Tekan `e`, `+`, `-` | Sama — tidak terketik. |
| Paste `2.5` | Kolom jadi `25` (digit diambil, pemisah dibuang) — bukan `2.5`. |
| Ketik `0` | Jadi `1`. Tak seorang pun bermaksud menagih nol buah barang yang baru diketik. |
| Kosongkan kolomnya | Jadi `1`. |
| Panah atas/bawah | Naik-turun satu-satu. |

**Kenapa sekeras ini:** `<input type="number">` melaporkan nilai **kosong** untuk apa pun yang
dianggapnya bukan angka sah — dan `2.` termasuk. Sebelum diperbaiki, mengetik "2.5" membuat kolom
berkedip ke `1` di tengah pengetikan. Kalau kamu melihat kedipan itu lagi, perbaikannya mundur.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 2.2 Input harga (mata uang)

USD:

| Ketik | Tampil | Tersimpan di vault |
|---|---|---|
| `19.99` | `19.99` | `1999` |
| `1234.567` | `1,234.56` (desimal ke-3 dipotong) | `123456` |
| `0.01` | `0.01` | `1` |

Klik di tengah angka `1,234.56` lalu ketik satu digit: **kursor tidak boleh melompat** ke ujung.
Salin isinya (⌘C) dan tempel di TextEdit — yang tersalin harus `1234.56` bersih, tanpa koma ribuan.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 2.3 Bug lama yang tidak boleh kembali

Alasan seluruh perubahan uang hari ini. Satu baris: **qty 3**, **harga 19.99**. Nyalakan **diskon 10%
(persen)** dan **PPN 8,5%**.

**Yang harus terbaca, persis:**

```
Subtotal   $59.97
Diskon     $6.00
Pajak      $4.59
TOTAL      $58.56
```

Ambil kalkulator: `59.97 − 6.00 + 4.59 = 58.56`. **Bagian-bagiannya harus menjumlah jadi totalnya.**
Itu properti yang dicek klienmu saat ia curiga.

**Bentuk kegagalannya:** total dengan digit aneh di ekornya, atau bagian yang tidak menjumlah. Dulu
`3 × 19.99` bernilai `59.97000000000001` di memori — layar membulatkannya, jadi kesalahannya tak
terlihat sampai ia menumpuk lewat diskon dan pajak.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 2.4 Pembulatan setengah

Ganti jadi **qty 1**, **harga 0.01**, diskon **50%**. Setengah sen tidak ada.

**Seharusnya:** diskon `$0.01`, total `$0.00` — dibulatkan **menjauhi nol**, bukan dipotong jadi 0.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`. Total $0.00 memang yang diharapkan: 50% dari $0.01 = setengah sen → dibulatkan menjauhi nol jadi $0.01 → total $0.00.



### 2.5 Diskon flat melebihi subtotal

**qty 1**, **harga 19.99**, diskon **flat 999**, PPN 10%.

**Seharusnya:** diskon dijepit ke `$19.99`, pajak `$0.00`, total `$0.00`. **Tidak pernah negatif.**

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 2.6 Angka besar

**qty 999**, **harga 1234.56**. Subtotal harus `$1,233,325.44` — tepat, tanpa pembulatan aneh di digit
terakhir.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



> **Meninggalkan:** masih 0 invoice tersimpan (semua di atas dilakukan di draf yang sama).

---

## Fase 3 — Menyimpan, dan batas Free

> **Keadaan awal:** `v-baru`, USD, **Free**, 0 invoice tersimpan.

### 3.1 Simpan menggerbangi Ekspor

Sebelum menyimpan, lihat toolbar.

**Seharusnya:** untuk invoice yang **belum pernah disimpan**, tombol Ekspor PDF/PNG **tidak ada sama
sekali** — bukan sekadar mati. (`showExport = saved`, `editor-toolbar.tsx`.) Ia baru muncul setelah
Simpan pertama.

Setelah muncul: ubah sesuatu → tombolnya **meredup**, tooltip-nya berubah jadi "simpan dulu", dan
mengkliknya tidak melakukan apa-apa. Simpan lagi → terang kembali.

Ini disengaja: mengekspor draf yang belum tersimpan akan membakar nomor invoice yang belum
benar-benar ada.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`. Arif yang benar: tombolnya TIDAK ADA sampai simpan pertama, bukan sekadar mati. Dokumen dibetulkan.



### 3.2 Invoice #1 — walkthrough, modal sukses, katalog otomatis

Rapikan draf-nya jadi invoice yang masuk akal: pilih klien **(Sample)**, satu baris dengan deskripsi
**baru** yang belum ada di katalog (misalnya `Audit halaman arahan`), qty dan harga bebas. Simpan.

**Seharusnya, tiga hal sekaligus:**

- **Beacon walkthrough padam** setelah simpan pertama, dan tidak kembali.
- **Modal sukses** muncul (~0,5 detik setelah animasi tombol Simpan selesai — kalau ia menyela
  animasinya, itu regresi).
- Deskripsi tadi **otomatis masuk Katalog** beserta harganya. Cek di halaman Katalog.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 3.3 Simpan ulang ≠ simpan baru

Ubah sesuatu di invoice #1, simpan lagi.

**Seharusnya:** hanya **toast**, bukan modal. Modal sukses muncul untuk setiap invoice **baru**, bukan
sekali seumur hidup vault.

Sekarang buat invoice **#2** dari nol dan simpan → modal **muncul lagi**. Itu benar.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 3.4 Katalog tidak menduplikasi

Di invoice #2, pakai deskripsi yang **sudah** ada di katalog (huruf besar-kecil berbeda pun tetap
dianggap sama), dengan harga berbeda. Simpan.

**Seharusnya:** katalog **tidak** bertambah entri kembar, dan harga entri lamanya **tidak** ditimpa.
Baris tanpa deskripsi dilewati begitu saja.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 3.5 Batas 3 invoice (Free)

> **Periksa dulu:** Settings → Dev → toggle Pro harus **mati**. Kalau menyala, tiga kasus berikut
> tidak akan terpicu sama sekali dan akan tampak lolos.

`FREE_INVOICE_LIMIT = 3`. Sekarang kamu punya 2. Buat dan simpan **invoice #3** — masih boleh.

Lalu tekan **New invoice** untuk yang keempat.

**Seharusnya:** editor **tidak terbuka**; dialog upgrade muncul dengan konteks batas-invoice. Invoice
yang sudah ada **tidak pernah disembunyikan atau dihapus** — hanya pembuatan baru yang diblokir.
Membuka dan **menyunting** invoice lama harus tetap bisa, termasuk menyimpannya lagi.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 3.6 Pengaman kedua di jalur Simpan — TIDAK PUNYA WUJUD YANG BISA DIUJI

Aku menulis prosedur untuk ini, dan prosedurnya mustahil. Arif menemukannya: toggle Pro **me-reload
jendela**, jadi kamu tidak bisa membiarkan draf terbuka sambil mematikan Pro.

Tapi masalahnya lebih dalam. Dengan gerbang di **pembuatan** sudah terpasang, kamu tidak akan pernah
bisa punya draf invoice **baru** yang terbuka sementara jumlah invoice sudah 3 — gerbangnya
menghalangi lebih dulu.

Pengaman ini memang bukan untukmu. Komentar kodenya mengatakannya: ia menangkap satu kasus tepi —
pengguna yang **memutakhirkan dari build lama** dan masih menyimpan draf keempat dari sebelum gerbang
pembuatan ada. Kasus itu tidak bisa direka ulang di build yang sudah punya gerbangnya.

**Jadi ia dilewati, dan itu jawaban yang benar** — bukan karena malas, tapi karena kasus ujinya tidak
punya wujud. Yang menjaganya adalah kodenya (`commit()` di `invoices-view.tsx`), dan itu sudah dibaca.

- [ ] **Dilewati — tidak punya wujud yang bisa diuji.** Arif, 14 Jul 2026. Lihat penjelasan di atas.



### 3.7 Gerbang Pro pada template

Masih **Free**. Buka pemilih template.

**Seharusnya:** semua template premium **terlihat dan bisa dipratinjau**. Memilih salah satunya
memunculkan dialog upgrade (kepala dialognya memperlihatkan pratinjau template, berbeda dari dialog
batas-invoice). Batalkan → template tetap Minimal.

**Pintu belakang.** Tutup app, ubah `template` di `invois-data.json` jadi `"aurora"`, buka lagi.
**Preview dan ekspor harus tetap Minimal.** Gerbangnya ada di render, bukan cuma di UI pemilih.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



> **Meninggalkan:** `v-baru`, 3 invoice tersimpan, katalog terisi, masih **Free**.
> **Sekarang nyalakan Dev → Pro** dan biarkan menyala sampai Fase 8.

---

## Fase 4 — Ekspor (Pro)

> **Keadaan awal:** `v-baru`, 3 invoice, **Pro menyala**.

### 4.1 PDF

Ekspor satu invoice 1 halaman. Lalu tambahkan ~30 baris item pada satu invoice dan ekspor lagi →
**lebih dari 2 halaman**.

**Seharusnya:** teks bisa diseleksi; menyeret di satu sel tabel tidak menyeret seluruh baris;
salin-tempel ke Notes menghasilkan tabel rapi. Buka di Chrome **dan** Preview — keduanya harus baik.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`


### 4.2 Font di build dev — DILEWATI, digantikan 12.2

Jangan kerjakan ini. Menguji font pada build **dev** tidak membuktikan apa pun: kebocoran font Apple
dulu hidup di **jalur cetak produksi**, dan build dev tidak melewatinya dengan cara yang sama.
Pemeriksaan yang sesungguhnya ada di **12.2**, pada app yang benar-benar dipaket.

- [ ] **Dilewati** — digantikan 12.2


### 4.3 PNG dan nama file

Ekspor PNG — cek ketajaman teks, tidak ada tepi terpotong. Lalu ekspor invoice yang **sama** dua kali
ke folder yang sama → file kedua dapat nama unik, **tidak menimpa**.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`


### 4.4 Folder ekspor memulihkan diri

Hapus folder `Exports` lewat Finder, lalu ekspor lagi. **Seharusnya:** folder dibuat ulang, ekspor
berhasil, tidak ada error.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



> **Meninggalkan:** sama, plus beberapa file di `Exports`.

---

## Fase 5 — Settings

> **Keadaan awal:** `v-baru`, 3 invoice, Pro.

Ada **delapan** bagian (yang terakhir hanya di build dev):

| Bagian | Yang diuji |
|---|---|
| Profil bisnis | Nama, email, telepon, **alamat**, logo (unggah PNG/SVG, ganti, hapus), warna aksen, mode kop surat (logo vs nama teks) |
| Pembayaran | Nama bank, nomor rekening, atas nama — muncul di footer preview |
| Default invoice | Termin pembayaran, mata uang (5.2), format tanggal (5 pilihan), PPN default, catatan default |
| Penomoran invoice | 5.3 |
| Template invoice | Grid template (sudah diuji di 3.7) |
| Preferensi | Bahasa (5.1) dan 6 palet (5.4) |
| Data & ekspor | Daftar bisnis (Fase 6) + folder ekspor |
| Dev | Toggle Pro. **Pastikan tab ini tidak ada di build produksi.** |

### 5.1 Bahasa TIDAK boleh menggerakkan placeholder telepon

Bagian kedua dari uji 1.2. Buka Profil bisnis, lihat placeholder telepon (`+1 (415) 555-xxxx`, karena
mata uangmu USD). Sekarang Preferensi → ganti bahasa ke **Indonesia**, lalu kembali ke Profil bisnis.

**Seharusnya:** placeholder **tidak bergerak sedikit pun**. Bahasa tidak memberi tahu apa pun tentang
di mana seseorang tinggal — freelancer Indonesia yang memakai UI bahasa Inggris tetap punya nomor
Indonesia. Kalau placeholder berubah mengikuti bahasa, itu bug yang persis pernah ada di app ini.

Sekalian telusuri seluruh UI dalam bahasa Indonesia: cari teks yang tidak ikut berganti, dan **key
mentah** yang bocor ke layar (misalnya `inv.dueLabel` alih-alih "Jatuh tempo:"). Cek juga tanggal di
preview invoice: `1 Januari 2026` (ID) vs `January 1, 2026` (EN).

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 5.2 Kunci mata uang

Kamu punya 3 invoice tersimpan. Coba ganti mata uang.

**Seharusnya:** peringatan yang menyebut jumlah invoice terdampak, dan butuh konfirmasi eksplisit.
Alasannya jujur: harga tersimpan **tidak dikonversi** — mengganti mata uang mengubah arti angka yang
sama. Batalkan.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 5.3 Penomoran

Tersedia **delapan** token: `{PREFIX}` `{YYYY}` `{YY}` `{MM}` `{MMM}` `{DD}` `{CLIENT}` `{SEQ}`. Klik
satu untuk menyalin → toast muncul.

Buat invoice baru **tanpa mengubah format** → urutannya **melanjutkan** nomor terakhir.

Lalu ubah formatnya jadi `{PREFIX}/{YYYY}/{MM}/{SEQ}`, padding 4, dan buat invoice lagi.

**Urutannya akan mengulang dari 1, dan itu BENAR.** Aku sempat menulis sebaliknya, dan Arif
menabraknya. Penjelasannya: pencacah dihitung **per-lingkup**, dan lingkupnya adalah formatmu dengan
semua token terisi kecuali `{SEQ}`. Ganti formatnya, dan kamu pindah ke lingkup baru yang memang belum
punya nomor apa pun.

Itu bukan efek samping — itu justru fiturnya. Format ber-`{MM}` mereset pencacah tiap bulan;
ber-`{CLIENT}` mencacah per klien. Kemampuan yang sama itulah yang membuat pergantian format memulai
seri baru.

> **Keputusan produk yang belum pernah diambil sadar:** apakah memulai seri dari 1 di tengah tahun itu
> yang kamu mau? Untuk akuntansi umumnya aman (string nomornya berbeda, jadi tidak ada duplikat), tapi
> ini layak diputuskan, bukan diwarisi.

Lalu uji `{CLIENT}`: masukkan ke format, buat invoice, dan **ganti kliennya**. Nomornya harus ikut
berubah. Ini token yang paling mungkin patah — satu-satunya yang bergantung pada isi invoice, bukan
pada tanggal atau hitungan.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`. Pengulangan dari 1 setelah ganti format itu BENAR (lingkup baru); harapanku yang salah, sudah dibetulkan. `{CLIENT}` lolos.



### 5.4 Palet

Enam palet: Corporate, Cool Neutral, Amber Cream, Ocean, Jewel, Midnight.

**Midnight** yang paling perlu diperhatikan — ia satu-satunya tema **gelap**, jadi di sanalah kontras
pertama kali patah. Telusuri seluruh app dengan Midnight menyala dan cari teks yang hilang ke
latarnya: chip status, grafik dashboard, dan (nanti di Fase 8) banner kuning mode aman di atas latar
gelap.

**Preview invoice harus tetap putih** apa pun paletnya. Palet mengubah app, bukan dokumen yang sampai
ke klien.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



> **Meninggalkan:** `v-baru` dengan profil lengkap. Kembalikan bahasa dan palet ke selera kerjamu.

---

## Fase 6 — Banyak bisnis, dan data dalam jumlah besar

> **Keadaan awal:** `v-baru`, Pro.

Fase ini punya dua tujuan sekaligus: menguji vault ganda, **dan** memberimu vault berisi ratusan
invoice — yang dibutuhkan Fase 7 (daftar & dashboard) dan mustahil dibuat dengan tangan.

### 6.1 Menambahkan bisnis kedua

Settings → Data & ekspor → **Tambah bisnis** → arahkan ke salah satu vault dummy:

```
Invoice Generator/Invois Dummy Vault EN     (431 invoice, USD)
```

**Seharusnya:** diterima (kamu Pro). Berpindah ke sana → **seluruh** data berganti: klien, katalog,
invoice, profil bisnis, penomoran.

**Ini pemeriksaan terpenting di fase ini:** kalau ada **satu saja** yang bocor antar bisnis — satu
klien dari `v-baru` muncul di sini, atau profil bisnismu ikut terbawa — itu bug data, dan seriusnya
setara dengan menimpa vault.

Vault dummy ini berformat **lama**, jadi ia akan dimigrasi saat dibuka. Cek beberapa totalnya masuk
akal (bukan 100× lipat, bukan 1/100).

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 6.2 Batas 1 bisnis (Free)

Matikan **Dev → Pro** sebentar, lalu coba Tambah bisnis lagi.

**Seharusnya:** dialog upgrade, bukan pemilih folder (`FREE_VAULT_LIMIT = 1`). Tapi **memindahkan**
vault yang sudah ada harus tetap gratis — memindahkan bukan menambah. Pastikan Relocate tidak ikut
tergerbang.

Nyalakan Pro lagi.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`. (Arif minta penjelasan: Free hanya boleh 1 bisnis; menambah yang kedua → dialog upgrade. Memindahkan yang satu-satunya tetap gratis.)



### 6.3 Menghapus bisnis tidak menghapus file

Hapus salah satu bisnis dari daftar.

**Seharusnya:** **file di disk tetap ada.** Pastikan dengan Finder. Daftar bisnis itu pointer, bukan
data.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 6.4 Memindahkan vault — folder Exports harus ikut

**Prasyarat:** vault yang folder ekspornya masih **default**, yaitu `<vault>/Exports`. Kalau kamu
pernah menggantinya ke folder lain, ia **memang tidak akan ikut pindah** — itu disengaja (folder
pilihanmu sendiri tidak boleh dipindah-pindah app diam-diam). Karena itu langkah 1–3 membuat vault
baru yang bersih.

1. **Tutup app** sepenuhnya (⌘Q). Lalu:

   ```bash
   mkdir -p ~/Desktop/qa/v-reloc
   ```

2. Jalankan app. Di DevTools Console:

   ```js
   localStorage.removeItem("invois_vault_config");
   location.reload();
   ```

3. Onboarding → pilih `~/Desktop/qa/v-reloc` → isi profil → selesai.

4. Buka **Settings → Data & ekspor**. Catat isi kolom folder ekspor. **Harus** berbunyi:

   ```
   ~/Desktop/qa/v-reloc/Exports
   ```

   Kalau bukan itu, hentikan — prasyaratnya tidak terpenuhi.

5. **Tutup app** (⌘Q). Lalu pindahkan foldernya:

   ```bash
   mv ~/Desktop/qa/v-reloc ~/Desktop/qa/v-reloc-pindah
   ```

6. Jalankan app lagi. Layar **"vault tidak ditemukan"** muncul.

7. Klik tombol untuk mencari lokasinya → pilih `~/Desktop/qa/v-reloc-pindah`. App memuat ulang.

8. Buka **Settings → Data & ekspor** lagi dan baca kolom folder ekspor.

**Seharusnya sekarang berbunyi:**

```
~/Desktop/qa/v-reloc-pindah/Exports
```

**Bentuk kegagalannya (yang Arif lihat):** ia masih berbunyi `~/Desktop/qa/v-reloc/Exports` — menunjuk
folder yang sudah tidak ada.

Sebabnya bukan yang kuduga. Kodenya ada dan benar, tapi petunjuk relokasinya **sekali pakai** dan
dibaca di dalam React effect — dan StrictMode menjalankan effect **dua kali** di dev. Jalan pertama
memakai habis petunjuknya, menunggu disk, lalu membuang hasilnya sendiri (bendera `cancelled`-nya
sudah menyala karena cleanup StrictMode sudah jalan). Jalan kedua tidak menemukan apa-apa lagi.
Sekarang: **baca → terapkan → baru hapus.**

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6e52c5d`. Sempat GAGAL (folder Exports tetap di path lama; petunjuk relokasi sekali-pakai dimakan habis oleh StrictMode yang menjalankan effect dua kali). Diperbaiki: baca → terapkan → baru hapus.



> **Meninggalkan:** dua bisnis terdaftar. **Aktifkan yang dummy** (431 invoice) untuk fase berikutnya.

---

## Fase 7 — Daftar & dashboard (butuh banyak data)

> **Keadaan awal:** vault dummy aktif, ratusan invoice, Pro.

### 7.1 Daftar invoice

Cari (nomor **dan** nama klien), filter status (Semua / Belum bayar / Lewat jatuh tempo / Lunas),
urutkan (Terbaru / Terlama / **Jumlah** / Jatuh tempo), paginasi (20 per halaman), tandai lunas dari
daftar **dan** dari toolbar editor (keduanya harus sinkron), duplikat, hapus (dialog konfirmasi
in-app, bukan dialog bawaan browser).

**Perhatian khusus pada urutan "Jumlah":** kolom total di daftar sekarang memakai `calcTotals` yang
sama dengan editor. Dulu daftar ini punya **salinan kedua** rumus uangnya, dan salinan itu sudah mulai
menyimpang. Buka salah satu invoice dan bandingkan totalnya dengan yang tertulis di daftar — **harus
identik**.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 7.2 Dashboard — prioritas rendah

> **Keadaan:** vault dummy aktif (ratusan invoice), Pro menyala, app jalan (`npm run dev`).

**Yang diuji:** apakah angka di halaman Home cocok dengan angka di halaman Invoices.

1. Home → pilih rentang **12M** → metrik **Ditagih**.
2. Arahkan kursor ke satu batang bulan (misal Mei). Catat angkanya.
3. Invoices → cari/urutkan sampai kamu bisa menjumlahkan invoice bertanggal Mei.

**Seharusnya:** kedua angka **sama**. Kalau berbeda, dashboard memakai rumus yang berbeda dari daftar
— dan itu bug yang sama jenisnya dengan salinan-kedua rumus uang yang sudah kita buang.

Coba juga rentang 3M/6M/YTD dan metrik Dibayar/Jumlah — cukup pastikan tidak ada yang kosong atau NaN.

> **Klik pada batang grafik tidak melakukan apa-apa.** Itu bukan bug yang perlu dilaporkan — fiturnya
> hilang saat Recharts dicopot, dan sedang menunggu keputusan.

- [ ] Lolos



### 7.3 Klien & katalog

Tambah, ubah, hapus, cari, di kedua halaman. Harga katalog memakai input mata uang yang sama — ulangi
2.2 secara singkat di sini.

Hapus klien yang dipakai invoice tersimpan → **invoice lamanya tidak boleh berubah.** Invoice menyimpan
salinan data kliennya sendiri; ia dokumen, bukan tautan.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



> **Meninggalkan:** apa pun. Fase berikutnya me-reset onboarding.

---

## Fase 8 — Adopsi & penjaga sarang

> **Keadaan awal:** apa pun. Fase ini **menghapus pointer**, jadi ia harus datang setelah semua uji
> app di atas.

### 8.1 Siapkan sumber yang bisa dibedakan

Ini bukan kerewelan. Kalau kamu menyalin `v-baru` apa adanya, ia **sudah** membawa klien dan katalog
"(Sample)" sejak dibuat — dan kamu tidak akan punya cara membedakan "Sample ikut terbawa file" (benar)
dari "Sample disemai ulang oleh app" (bug). Kasus ujinya jadi tidak bisa dijatuhkan.

Salin `v-baru` → `v-adopsi`, buka, **hapus** klien dan item katalog "(Sample)"-nya, tambahkan klien
bernama `KLIEN ADOPSI`, simpan satu invoice, tutup app. Lalu catat isinya:

```bash
python3 -c "
import json,sys
d=json.load(open(sys.argv[1]))
v=lambda k: json.loads(d[k]) if isinstance(d.get(k),str) else d.get(k) or []
print('klien', len(v('invois_customers')), '| katalog', len(v('invois_catalog')), '| invoice', len(v('invois_history')))
print('sample:', [c.get('id') for c in v('invois_customers')+v('invois_catalog') if str(c.get('id','')).startswith('sample-')])
" ~/Desktop/qa/v-adopsi/invois-data.json
```

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`


### 8.2 Adopsi (kasus install ulang)

Hapus pointer, reload, dan di onboarding pilih folder `v-adopsi`.

**Seharusnya:** invoice dan `KLIEN ADOPSI` muncul, profil bisnis **ter-prefill** dari vault, dan jumlah
klien/katalog **persis sama** dengan yang barusan kamu catat. **Tidak ada record ber-id `sample-` yang
muncul** — kalau ada, app menyemai ke atas vault orang.

**Bentuk kegagalan yang paling berbahaya:** app menyapamu dengan vault **kosong**, lalu menimpa file
itu pada penyimpanan berikutnya. Kalau History kosong padahal file berisi, **hentikan dan jangan
simpan apa pun.**

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 8.3 Menolak folder di dalam vault lain

Dua jalur, dua kode penjaga — dan keduanya pernah tidak sepakat.

**Onboarding.** Pilih `~/Desktop/qa/v-baru/Backups` → ditolak. Pilih induknya (`~/Desktop/qa`) →
ditolak juga.

**Settings → Tambah bisnis.** Ulangi keduanya. Lalu kasus yang paling penting:

Vault aktifmu sekarang `v-adopsi`, jadi **`v-baru` sudah tidak terdaftar lagi**. Dalam keadaan itu,
tambahkan `~/Desktop/qa/v-baru/Backups`.

**Seharusnya:** tetap ditolak. `v-baru` tidak terdaftar, tapi ia **tetap sebuah vault**.

**Bentuk kegagalannya** (bug nyata, 13 Jul 2026): folder itu **diterima**, dan app menulis vault kosong
baru **ke dalam folder Backups milik vault lain**. Penyebabnya, penjaga `addVault` dulu hanya memeriksa
daftar bisnis **terdaftar**, sementara onboarding memeriksa **disk**. Kalau folder itu diterima lagi,
atau muncul `invois-data.json` di dalam `v-baru/Backups`, **lapor**.

Terakhir, pastikan yang **boleh** tetap boleh: menambahkan `~/Desktop/qa/v-baru` sendiri harus
berhasil. Perbaikan yang menolak segalanya juga "lolos" uji pertama.

---

#### Uji ulang 8.3 — langkah persisnya

> **PENTING: tutup app dan jalankan `npm run dev` dari awal.** Perbaikan ini menambah jembatan baru di
> lapisan Electron (`fs.readDirs`). Sekadar ⌘R **tidak cukup** — proses main-nya tidak ikut dimuat ulang.

**Siapkan:** pastikan `~/Desktop/qa` berisi minimal satu folder vault.

```bash
ls -d ~/Desktop/qa/*/           # harus ada v-baru, v-adopsi, dst.
ls ~/Desktop/qa/invois-data.json 2>/dev/null || echo "bersih: tidak ada vault di folder induk"
```

**(a) Lewat onboarding.** DevTools Console:

```js
localStorage.removeItem("invois_vault_config");
location.reload();
```

Onboarding langkah 1 → Browse → pilih **`~/Desktop/qa`** (folder INDUK-nya, bukan v-baru).

→ **Harus DITOLAK.** Ini yang sebelumnya diterima.

**(b) Masih di onboarding:** pilih `~/Desktop/qa/v-baru` → **harus DITERIMA.**

**(c) Lewat Settings.** Settings → Data & ekspor → Tambah bisnis → pilih `~/Desktop/qa` →
**harus DITOLAK.**

**(d)** Tambah bisnis → `~/Desktop/qa/v-baru/Backups` → **harus DITOLAK** (ini sudah benar sebelumnya).

**(e)** Tambah bisnis → folder kosong yang benar-benar terpisah, misalnya:

```bash
mkdir -p ~/Desktop/qa2
```

→ **harus DITERIMA.** Perbaikan yang menolak segalanya juga akan "lolos" (a)–(d); langkah ini yang
membuktikan ia tidak asal menolak.

**Terakhir, pastikan tidak ada yang tertulis diam-diam:**

```bash
ls ~/Desktop/qa/invois-data.json
```

→ harus **"No such file"**. Kalau file itu ada, app menulis vault ke folder induk — lapor.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6e52c5d`. Sempat GAGAL dua kali: (1) folder INDUK yang memuat vault diterima — penjaganya cuma memeriksa satu arah; (2) setelah dijaga, ia menolak **dalam diam** — `catch` menelan errornya, jadi Finish sekadar tidak melakukan apa-apa. Keduanya diperbaiki.



> **Meninggalkan:** `v-adopsi` aktif.

---

## Fase 9 — Migrasi format vault

> **Keadaan awal:** apa pun. **Tutup app** sebelum tiap langkah di bawah.

Sudah diuji lewat dry-run pada 789 invoice nyata: semua total identik sebelum dan sesudah migrasi.
Yang **belum** terbukti oleh data nyata: **nol** dari 789 invoice itu memakai **diskon flat** — dan itu
justru jalur paling berbahaya. Jadi kamu harus membuat kasusnya sendiri.

### 9.1 Diskon flat pada vault format lama — YANG PALING PENTING DI FASE INI

> **Keadaan awal:** app **TERTUTUP** (⌘Q). Pro boleh menyala atau mati, tidak berpengaruh.

**Yang diuji:** apakah migrasi format lama → format 3 menskalakan **diskon flat** dengan benar.

Kenapa ini yang paling penting: dry-run pada 789 invoice nyata membuktikan setiap total identik
sebelum dan sesudah migrasi — tapi **nol** dari 789 itu memakai diskon flat. Padahal diskon flat
adalah **satu-satunya jalur yang pernah benar-benar gagal**: ia sempat menskalakan dua kali, mengubah
$50 jadi $5.000. Unit test menutupinya. Belum ada manusia yang melihatnya bekerja pada file sungguhan.

**Langkah 1 — buat vault format lamanya.** Jangan mengedit JSON dengan tangan; ada skripnya:

```bash
cd invois-macos
node scripts/qa-legacy-vault.mjs ~/Desktop/qa/v-lama
```

Skrip itu mencetak angka yang harus kamu lihat nanti. Ia membuat vault **tanpa** penanda `__invois`,
dengan uang masih desimal (`"price": 19.99`) dan field lama (`"discount": 50`) — persis seperti vault
yang dibuat build lama.

**Langkah 2 — adopsi vault itu.**

1. Jalankan app.
2. DevTools Console: `localStorage.removeItem("invois_vault_config"); location.reload();`
3. Onboarding → pilih `~/Desktop/qa/v-lama` → selesaikan. (Profilnya sudah terisi dari vault.)

**Langkah 3 — baca angkanya.** Buka **Invoices**. Buka ketiga invoice satu per satu.

| Invoice | Subtotal | Diskon | Pajak | **Total** |
|---|---|---|---|---|
| **INV-001** (flat) | $199.90 | **$50.00** | $0.00 | **$149.90** |
| **INV-002** (persen 10%) | $199.90 | **$19.99** | $0.00 | **$179.91** |
| **INV-003** (kontrol) | $59.97 | $0.00 | $5.10 | **$65.07** |

**Bentuk kegagalan yang dicari, pada INV-001:**

- Diskon **$0.50** → migrasinya **tidak** menskalakan diskon flat. Uang pelanggan hilang 99%.
- Diskon **$5,000.00** → migrasinya menskalakan **dua kali**. Ini yang pernah terjadi.
- INV-002 diskonnya bukan $19.99 → persen ikut diskalakan, 10% jadi 1000%.

**Langkah 4 — pastikan file-nya juga benar.** Ubah apa saja di app lalu **Simpan** (supaya migrasinya
mendarat ke disk). Lalu:

```bash
python3 -m json.tool ~/Desktop/qa/v-lama/invois-data.json | head -5
grep -o 'discountValue": [0-9]*' ~/Desktop/qa/v-lama/invois-data.json | head -3
grep -c '"price":' ~/Desktop/qa/v-lama/invois-data.json || echo "0 (benar: field lama sudah hilang)"
```

**Seharusnya:** baris pertama memuat `"__invois": { "format": 3 }`; ada `discountValue": 5000`; dan
**tidak ada lagi** field `"price":` (semuanya sudah jadi `priceMinor`).

- [ ] Lolos



### 9.2 Buka-lalu-tutup tidak boleh menulis apa pun

> **Keadaan awal:** app **TERTUTUP**.

**Yang diuji:** membuka app tidak boleh, dengan sendirinya, mengubah file di disk.

Kenapa itu janji yang penting: kalau membuka app mengonversi file ke format baru, kamu **mengambil
jalan pulang penggunanya**. Seseorang membuka build baru, ragu, keluar, lalu kembali ke versi yang ia
percaya — dan versi itu kini bertemu format yang tidak dikenalnya dan menolak bekerja. Kita
memutakhirkan datanya tanpa bertanya, hanya karena ia sempat mengklik ikonnya sekali.

> **Prosedur lamaku cacat, dan Arif menabraknya.** Ia menyuruh mengadopsi vault lewat **onboarding** —
> padahal onboarding **menulis profil bisnis** ke vault. Jadi md5-nya pasti berubah, dan kamu tidak
> bisa membedakan "app menulis karena migrasi" dari "app menulis karena onboarding". Kasus ujinya tidak
> bisa dijatuhkan.
>
> Solusinya: **lewati onboarding sama sekali.** Tunjuk vault-nya langsung.

**Langkah 1 — buat vault format lama yang bersih, dan catat sidik jarinya:**

```bash
node scripts/qa-legacy-vault.mjs ~/Desktop/qa/v-lama2
md5 ~/Desktop/qa/v-lama2/invois-data.json
```

**Langkah 2 — jalankan app, lalu tunjuk vault itu LANGSUNG** (tanpa onboarding). DevTools Console:

```js
localStorage.setItem("invois_vault_config", JSON.stringify({
  vaults: [{ id: "qa-92", name: "v-lama2", dir: "/Users/arifriyanto/Desktop/qa/v-lama2" }],
  activeId: "qa-92",
  onboarded: true
}));
location.reload();
```

App langsung masuk ke vault itu. Kamu akan melihat ketiga invoice-nya.

**Langkah 3 — JANGAN SENTUH APA PUN.** Jangan buka invoice, jangan klik, jangan ketik. Langsung **⌘Q**.

**Langkah 4:**

```bash
md5 ~/Desktop/qa/v-lama2/invois-data.json
```

**Seharusnya:** md5-nya **persis sama** dengan Langkah 1. File masih format lama, masih bisa dibaca
build kemarin.

**Bentuk kegagalannya:** md5 berubah. Artinya sekadar membuka app sudah menulis ulang vault orang.

**Langkah 5 — dan pastikan migrasinya tetap mendarat saat memang harus.** Buka app lagi, ubah apa saja
(misal tambah satu klien), simpan, tutup. Sekarang:

```bash
head -3 ~/Desktop/qa/v-lama2/invois-data.json
```

**Seharusnya:** sekarang memuat `"__invois": { "format": 3 }`. Migrasi menunggu suntingan sungguhan —
lalu mendarat.

- [ ] Lolos



> **Meninggalkan:** apa pun.

---

## Fase 10 — Kasus rusak (destruktif — jalankan TERAKHIR)

> **Keadaan awal:** pakai `v-rusak` (salin vault mana pun ke sana dan adopsi). **Fase ini sengaja
> membuat app masuk mode aman**, yang membatalkan keabsahan uji lain — karena itu ia paling akhir.

Prinsip yang dipegang app: **lebih baik menolak bekerja daripada menimpa sesuatu yang gagal dibaca.**

Untuk semuanya: **tutup app dulu**, ubah file, baru buka.

### 10.1 JSON rusak

Rusak `invois-data.json` (hapus satu kurung kurawal).

**Seharusnya:** app memuat dari `.bak1` dan memasang **banner kuning permanen** yang tidak bisa
ditutup.

Lalu buktikan bahwa app benar-benar **menolak menulis** — ini bagian yang tadi kutulis terlalu
singkat ("ketik sesuatu"), dan pantas dipertanyakan:

1. Catat ukuran file rusaknya: `ls -l <vault>/invois-data.json`
2. Di app, **ubah apa pun yang biasanya memicu penyimpanan** — ketik nama klien, tambah baris item,
   ubah harga.
3. Tunggu ±2 detik (penyimpanan ditunda 500 ms), lalu tutup app (⌘Q).
4. Cek ukurannya lagi.

**File rusak itu harus masih persis sama.** Kalau ia tertimpa, itu bug serius — lapor.

Inilah janji mode aman, dan satu-satunya cara membuktikannya: lebih baik app menolak bekerja daripada
menimpa sesuatu yang gagal ia baca.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`. Banner muncul. (Instruksi 'ketik sesuatu' terlalu kabur — sudah diperjelas.)



### 10.2 JSON sah, bentuk salah — kerusakan yang paling berbahaya

> **Keadaan awal:** app **TERTUTUP**. Pakai vault sekali-pakai:
>
> ```bash
> rm -rf ~/Desktop/qa/v-rusak && cp -R ~/Desktop/qa/v-baru ~/Desktop/qa/v-rusak
> ```

**Yang diuji:** app menolak menulis ke vault yang **bisa di-parse tapi bentuknya salah**.

Ini kerusakan paling berbahaya karena ia lolos dari setiap pemeriksaan yang cuma bertanya "apakah file
ini JSON yang sah?" — dan jawabannya **ya**. Yang salah bukan sintaksnya, tapi **bentuknya**. Tanpa
penjagaan ini, vault berisi 300 invoice tampak seperti vault baru yang kosong, dan simpan berikutnya
mengabadikan kekosongan itu.

1. Buka `~/Desktop/qa/v-rusak/invois-data.json`. Cari kunci `"invois_history"`. Nilainya sebuah
   **array**, diawali `[`.

2. Ganti **seluruh nilainya** jadi sebuah **objek**. Dari:

   ```json
     "invois_history": [ { "id": "inv-1", ... }, { "id": "inv-2", ... } ],
   ```

   menjadi:

   ```json
     "invois_history": { "oops": true },
   ```

   Simpan. Pastikan file-nya masih JSON yang sah:

   ```bash
   python3 -m json.tool ~/Desktop/qa/v-rusak/invois-data.json > /dev/null && echo "JSON sah — bagus, memang harus begitu"
   ```

3. Catat ukurannya: `ls -l ~/Desktop/qa/v-rusak/invois-data.json`

4. Jalankan app → DevTools: `localStorage.removeItem("invois_vault_config"); location.reload();`
   → onboarding → pilih `~/Desktop/qa/v-rusak`.

**Seharusnya:** **banner kuning mode aman** muncul di atas dan **tidak bisa ditutup**. Halaman Invoices
tampak kosong.

5. Sekarang buktikan ia benar-benar menolak menulis: **ubah apa pun** (ketik nama klien, tambah item),
   tunggu ±2 detik, lalu **⌘Q**.

6. `ls -l ~/Desktop/qa/v-rusak/invois-data.json`

**Seharusnya:** ukurannya **persis sama** dengan langkah 3, dan `"invois_history": { "oops": true }`
masih ada di dalamnya.

**Bentuk kegagalannya:** file tertimpa dengan `"invois_history": []`. Itu berarti app baru saja
menghapus 300 invoice orang karena satu field salah bentuk.

- [ ] Lolos



### 10.3 Vault dari masa depan

> **Keadaan awal:** app **TERTUTUP**. Pakai vault sekali-pakai:
>
> ```bash
> rm -rf ~/Desktop/qa/v-depan && cp -R ~/Desktop/qa/v-baru ~/Desktop/qa/v-depan
> ```

**Yang diuji:** app yang lebih **tua** tidak boleh menebak isi file dari app yang lebih **baru**.

Menebak berarti membuang field yang tidak dikenalnya, lalu **menyimpan kehilangan itu**. Inilah persis
kecelakaan yang menghancurkan vault Arif pada 13 Juli: kode lama bertemu format baru, tidak paham, dan
menyimpan kekosongannya.

1. Buka `~/Desktop/qa/v-depan/invois-data.json`. Di bagian paling atas, ubah penandanya jadi format
   **99**, dan tambahkan satu field karangan:

   ```json
   {
     "__invois": { "format": 99 },
     "fitur_masa_depan": "jangan hapus aku",
     "invois_settings": { ... }
   ```

   Simpan.

2. Jalankan app → reset pointer → onboarding → pilih `~/Desktop/qa/v-depan`.

**Seharusnya:** banner mode aman muncul, dengan alasan yang menyebut **format 99**.

3. Ubah sesuatu di app, tunggu, **⌘Q**. Lalu:

   ```bash
   grep -c "fitur_masa_depan" ~/Desktop/qa/v-depan/invois-data.json
   ```

**Seharusnya:** hasilnya **1** — field karangan itu **masih ada**. App tidak menulis apa pun.

**Bentuk kegagalannya:** hasilnya `0`. Artinya app membuang field yang tidak dipahaminya, lalu
menyimpan hasil pembuangan itu.

- [ ] Lolos



### 10.4 Folder vault hilang saat app berjalan

Saat app **berjalan**, pindahkan folder vault-nya lewat Finder.

**Seharusnya:** layar pemulihan ("vault tidak ditemukan") menawarkan mencari lokasinya — **bukan** app
kosong yang lalu menyimpan kekosongan itu ke pointer.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6013bed`



### 10.5 Backup ada, dan file utama tidak pernah hilang

> **Keadaan awal:** app **JALAN**, dengan vault yang sehat (pakai `~/Desktop/qa/v-baru`).
> Kalau app-mu sedang dalam mode aman dari 10.1–10.3, **ganti dulu ke vault yang sehat** — mode aman
> menolak menulis, jadi tidak akan ada backup yang terbentuk sama sekali.

**Yang diuji:** dua hal, dan yang kedua adalah utang darah.

**(a) Backup memang terbentuk.**

1. Buka sebuah invoice, ubah sesuatu, **Simpan**. Ulangi **4 kali**, beri jeda beberapa detik.
2. Lihat isinya:

   ```bash
   ls -la ~/Desktop/qa/v-baru/
   ls -la ~/Desktop/qa/v-baru/Backups/
   ```

**Seharusnya ada:**

| File | Apa itu |
|---|---|
| `invois-data.json` | yang utama |
| `invois-data.json.bak1` `.bak2` `.bak3` | rotasi, satu per simpan |
| `Backups/invois-2026-07-14.json` | snapshot harian — **satu file per hari**, bukan per simpan |

**(b) Menyembunyikan jendela TIDAK boleh merotasi backup.**

1. Catat isi foldernya: `ls -la ~/Desktop/qa/v-baru/ > /tmp/sebelum.txt`
2. **Tanpa mengubah apa pun di app**, minimalkan jendelanya lalu kembalikan. Ulangi **5 kali**.
3. Bandingkan:

   ```bash
   ls -la ~/Desktop/qa/v-baru/ > /tmp/sesudah.txt
   diff /tmp/sebelum.txt /tmp/sesudah.txt && echo "TIDAK BERUBAH — benar"
   ```

**Seharusnya:** `diff` tidak melaporkan apa pun.

**Kenapa ini penting.** Dulu ia berubah. Penyimpanan dipicu oleh `visibilitychange`, tanpa memeriksa
apakah ada yang benar-benar berubah — jadi tiap kali kamu menyembunyikan jendela, vault ditulis ulang
dan backup dirotasi. Artinya "3 backup" sebenarnya berarti "3 kali sembunyikan jendela", dan seseorang
bisa merotasi habis semua backup baiknya **tanpa mengetik satu huruf pun**.

Dan yang paling utama: **file utamanya tidak boleh pernah hilang, bahkan sesaat.** Rotasi sekarang
**menyalin**, tidak memindahkan. Versi lama memindahkannya — dan sebuah reload di celah itu mengambil
satu-satunya salinan yang tersisa. Begitulah vault Arif mati pada 13 Juli.

- [ ] Lolos



### 10.6 Data diedit tangan yang tetap sah — layar harus JUJUR

Kerusakan di sini bukan pada aritmetikanya. `calcTotals` sudah lama tidak mempercayai nilai dari disk.
Yang diuji: apakah **yang tampil di layar sama dengan yang dijumlahkan**.

1. **Tutup app** (⌘Q).

2. Buka `<vault>/invois-data.json` di editor teks. Cari `"invois_history"`, ambil **invoice pertama**,
   lalu **baris item pertama** di dalamnya. Bentuknya kira-kira:

   ```json
   "items": [
     { "id": "item-1-abc", "desc": "Audit halaman arahan", "qty": 1, "priceMinor": 15000 }
   ]
   ```

3. Ubah **dua angka** itu saja, jadi persis:

   ```json
   "items": [
     { "id": "item-1-abc", "desc": "Audit halaman arahan", "qty": 2.5, "priceMinor": -100 }
   ]
   ```

   Simpan file. (Perhatikan: file-nya tetap JSON yang sah. Yang salah adalah **nilainya**.)

4. Jalankan app. Buka invoice itu dari daftar **Invoices**.

**Seharusnya, di editor:**

| Kolom | Harus menampilkan |
|---|---|
| Qty | **2** — bukan 2.5 |
| Harga | **kosong / $0.00** — bukan 1, bukan -1 |
| Amount baris itu | **$0.00** |
| Subtotal | konsisten dengan yang di atas |

**Bentuk kegagalannya (yang Arif lihat):** kolom Qty menampilkan `2.5` dan Harga menampilkan `1`,
sementara subtotalnya diam-diam dihitung dari `2` dan `0`.

Aritmetikanya tidak pernah salah. **Layarnya yang bohong.** App yang diam-diam menjumlahkan sesuatu
selain yang ia tunjukkan padamu lebih berbahaya daripada app yang menampilkan angka salah secara
jujur — yang pertama tidak bisa kamu tangkap dengan mata. Sekarang baris item dibersihkan saat masuk
(`sanitizeInvoice`), jadi yang tampil = yang dihitung.

Tidak crash, tidak total negatif.

- [x] **Lolos** — Arif, 14 Jul 2026, commit `6e52c5d`. Sempat GAGAL: editor menampilkan qty 2.5 dan harga 1, sementara subtotal diam-diam dihitung dari 2 dan 0. Aritmetikanya tidak pernah salah; LAYARNYA yang bohong. Diperbaiki dengan `sanitizeInvoice` di batas masuk.



---

## Fase 11 — Jendela, menu, dan hal-hal Electron

> Bisa dijalankan kapan saja; ditaruh di sini karena tidak bergantung pada data.

1. **Klik kanan** di mana saja → menu konteks (Reload, Inspect element di dev).
2. **Menu native + pintasan.** Uji semuanya: jalurnya (`menu-action` dari proses main ke UI) terpisah
   dari tombol di layar dan bisa patah sendirian.

   | Pintasan | Seharusnya |
   |---|---|
   | ⌘, | Settings terbuka |
   | ⌘N | Editor invoice baru (dan **tergerbang** kalau Free sudah punya 3) |
   | ⌘1 / ⌘2 / ⌘3 / ⌘4 | Home / Invoices / Clients / Catalog |
   | ⌘B | Sidebar menguncup dan mengembang |

3. **Maksimalkan** jendela → ada kedipan hitam sesaat. **Bug yang sudah diketahui dan diparkir**
   (celah native NSWindow). Catat saja, jangan lapor sebagai baru.
4. Ikon Dock dan nama di **About** harus "Invois", bukan "Electron".
5. Sidebar menguncup: keadaannya bertahan setelah app ditutup dan dibuka lagi.
6. ⌘Q di tengah pengetikan → yang sudah kamu **simpan** harus utuh saat dibuka lagi.

> **Ikon Dock dan About:** di build **dev** keduanya akan bertuliskan "Electron", dan itu **wajar** —
> `npm run dev` menjalankan binary Electron bawaan, jadi identitas app datang dari Info.plist milik
> Electron, bukan milik kita. Kode kita berusaha menutupinya (`setName`, `setAboutPanelOptions`,
> `dock.setIcon`), tapi yang menentukan adalah build terpaket. **Pemeriksaan yang sesungguhnya ada di
> Fase 12.1**, bukan di sini.

- [ ] **Sebagian** — Arif, 14 Jul 2026: pintasan & menu lolos. Ikon Dock/About masih "Electron" di dev
  (wajar, lihat catatan di atas) → diperiksa ulang di Fase 12.


---

## Fase 12 — Build produksi (paywall & font)

> **Keadaan awal:** bukan `npm run dev`. Bangun app-nya sungguhan dan buka **yang terpaket**:
>
> ```bash
> npm run pack:mac
> open dist/mac*/Invois.app
> ```
>
> Semua fase di atas berjalan di build dev, dan build dev berbohong tentang dua hal: ia punya toggle
> Pro, dan ia memuat aset lewat dev server. Dua bug produksi terakhir (kebocoran font Apple, dan tiga
> bug yang hanya muncul setelah dipaket) tidak akan pernah terlihat di `npm run dev`.

### 12.1 Pro tidak bisa dinyalakan sama sekali

> **Keadaan awal:** app **TERTUTUP**, dan `npm run dev` **dimatikan**. Kita tidak sedang menguji build
> dev di sini — build dev berbohong tentang persis dua hal, dan ini salah satunya.

**Yang diuji:** app yang kamu kirim ke orang **tidak punya cara apa pun untuk menjadi Pro**.

Ini satu-satunya bagian dari aturan hak-beli (`docs/entitlement.md`) yang punya wujud hari ini —
billing belum ada, jadi tidak ada lagi yang bisa diuji. Dan ia yang paling mahal kalau salah: **kalau
tab Dev ikut terkirim, kita membagikan Pro gratis kepada semua orang.**

**Langkah 1 — bangun dan buka app yang sungguhan:**

```bash
cd invois-macos
npm run pack:mac
open dist/mac*/Invois.app
```

(Butuh beberapa menit. Ini bukan `npm run dev` — ini app yang benar-benar dipaket.)

**Langkah 2 — selesaikan onboarding** ke folder mana pun yang bersih, misal `~/Desktop/qa/v-prod`.

**Langkah 3 — buka Settings.**

**Seharusnya:** **tab "Dev" TIDAK ADA.** Bukan tersembunyi, bukan mati — **tidak ada**. Hitung
tabnya: harus **tujuh**, bukan delapan.

Penjagaannya berlapis dua (`isDevBuild()`): `NODE_ENV` **dan** `app.isPackaged`. Uji ini yang
membuktikan lapisan itu benar-benar bekerja pada app yang dipaket, bukan cuma tertulis di kode.

**Langkah 4 — buktikan gerbangnya masih berdiri.** Masih di app terpaket:

- Buat dan simpan **3 invoice**. Lalu coba yang **keempat** → harus digerbangi ke dialog upgrade.
- Buka pemilih template → pilih salah satu yang berlabel Pro → harus digerbangi.
- Settings → Data & ekspor → Tambah bisnis → harus digerbangi.

**Seharusnya:** ketiganya digerbangi, dan **tidak ada jalan keluar** di dalam app. Tidak ada toggle,
tidak ada tombol tersembunyi.

**Bentuk kegagalannya:** tab Dev muncul, atau salah satu gerbang bisa dilewati. Kalau itu terjadi,
**jangan rilis.**

- [ ] Lolos



### 12.2 Font, dari build yang sungguhan

> **Keadaan awal:** app **terpaket** dari 12.1 masih terbuka, dengan minimal satu invoice tersimpan.

**Yang diuji:** tidak ada font Apple yang tersemat di PDF yang diekspor.

Ini soal **lisensi**, bukan estetika. Font SF boleh **digambar di layar** — itu yang dilakukan setiap
app macOS. Tapi ia **tidak boleh disematkan** ke dokumen yang kamu distribusikan. Setiap invoice yang
dikirim penggunamu ke kliennya adalah dokumen yang didistribusikan.

**Kenapa build dev tidak bisa menggantikan uji ini:** kebocorannya dulu hidup di **jalur cetak**.
Jalur itu memasang template **tanpa** pembungkus preview, jadi `font-family` yang dipasang di
pembungkus tidak ikut — dan Chromium jatuh ke `system-ui`, yang di macOS berarti SF. Kebocorannya
tidak terlihat di layar sama sekali. Ia hanya ada di dalam file PDF-nya.

**Langkah 1 — ekspor PDF dari app TERPAKET.** Buka sebuah invoice → Ekspor PDF. Catat lokasi filenya.

**Langkah 2 — periksa fontnya:**

```bash
cd invois-macos
npm run pdf:fonts -- "<path/ke/hasil.pdf>"
```

**Seharusnya:** hanya **Inter** dan **RobotoMono**. Skripnya akan bilang PASS.

**Bentuk kegagalannya:** muncul `.SFNS`, `SFPro`, `SFUI`, atau nama font Apple apa pun. Itu **FAIL**,
dan berarti setiap PDF yang dihasilkan app ini menyematkan font berlisensi Apple.

> **Jangan pakai `strings | grep BaseFont` untuk memeriksa ini.** Ia tidak akan melihat apa-apa — font
> programnya terkompresi di dalam stream PDF. Itulah sebabnya `scripts/pdf-fonts.mjs` ada: ia
> mengembangkan setiap stream dan membaca tabel nama di dalam data font yang sesungguhnya. Kebocoran SF
> pertama kali ditemukan justru karena `strings` bilang "bersih" dan skrip ini bilang tidak.

**Langkah 3 — ulangi untuk PDF yang lebih dari 2 halaman** (tambahkan ~30 baris item). Jalur
paginasinya berbeda.

- [ ] Lolos



---

## Cara melaporkan kegagalan

Sebutkan: **fase dan nomor kasusnya**, langkah persisnya, yang kamu lihat, yang kamu harapkan. Kalau
menyangkut uang atau vault, **lampirkan `invois-data.json`-nya** (atau salin bagian yang relevan).

Untuk bug uang, angka mentah di file jauh lebih berguna daripada tangkapan layar: layar sudah
dibulatkan, file tidak.
