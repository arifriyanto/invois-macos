# Rencana uji manual — Invois (Electron)

Tanggal: 13 Juli 2026. Untuk `invois-macos`, dijalankan dengan `npm run dev`.

Dokumen ini melengkapi test otomatis, bukan menggantikannya. `npm run verify` sudah menjamin
aritmetika uang, migrasi vault, penomoran, i18n, dan persistensi. Yang **tidak** bisa dijamin unit
test adalah semua yang menyentuh disk sungguhan, jendela sungguhan, dan mesin cetak Chromium — dan
justru di sanalah tiga bug produksi terakhir bersembunyi. Itulah yang diuji di sini.

Setiap kasus punya bentuk yang sama: **langkah**, **yang seharusnya terjadi**, dan — untuk yang
berisiko — **seperti apa kegagalannya**. Bagian terakhir itu penting: bug yang paling merugikan di
app ini bukan yang membuat app crash, tapi yang membuat app tampak baik-baik saja sambil menyimpan
angka yang salah.

---

## 0. Persiapan

**Buat folder kerja yang bisa dibuang.** Jangan pernah menguji pada vault yang datanya kamu
sayangkan. Semua kasus di bawah mengasumsikan folder-folder sekali pakai:

```
mkdir -p ~/Desktop/qa/{v-baru,v-adopsi,v-rusak,v-bisnis2}
```

**Cara mengulang onboarding dari nol.** Pointer ke vault disimpan di localStorage, bukan di vault.
Buka DevTools (⌥⌘I), lalu di Console:

```js
localStorage.removeItem("invois_vault_config");
location.reload();
```

Ini **tidak** menghapus file vault-mu — hanya melupakan lokasinya. Vault lamanya masih di disk dan
bisa diadopsi ulang. (Kalau kamu juga ingin app lupa segalanya: `localStorage.clear()`.)

**Menyalakan Pro (khusus build dev).** Settings → tab **Dev** (ikon kunci inggris; tab ini tidak
pernah ada di build produksi) → toggle Pro. Tanpa ini kamu Free, dan hanya template Minimal yang
bisa dipilih.

**Melihat isi vault.** Selama pengujian, ini teman terbaikmu:

```bash
python3 -m json.tool ~/Desktop/qa/v-baru/invois-data.json | head -40
```

Angka uang di file sekarang **bilangan bulat satuan terkecil**: `1999` = $19,99. Untuk IDR, satuan
terkecilnya adalah rupiah itu sendiri, jadi `2500000` = Rp 2.500.000. Kalau kamu melihat `19.99`
dengan titik desimal di dalam file, itu bug.

---

## 1. Onboarding

### 1.1 Jalur normal — vault baru

1. Hapus pointer (lihat Persiapan), reload.
2. Layar onboarding muncul: panel kiri biru dengan ilustrasi, form di kanan.
3. Langkah 1 — pilih lokasi data. Arahkan ke `~/Desktop/qa/v-baru`.
4. Langkah 2 — isi profil bisnis (nama, email, telepon, alamat).
5. Selesaikan.

**Seharusnya:** app masuk ke editor invoice dengan walkthrough beacon menyala (titik berdenyut di
tombol Klien → Item → Simpan). File `invois-data.json` muncul di `v-baru`. Di dalamnya ada satu
klien contoh dan satu item katalog, keduanya berlabel **(Contoh)**.

Buka file itu. **Seharusnya** ada baris `"__invois": { "format": 3 }` di paling atas, dan harga item
contoh berupa bilangan bulat tanpa titik desimal.

- [ ] Lolos

### 1.2 Placeholder ikut mata uang, bukan bahasa

Di langkah 2, perhatikan placeholder nomor telepon.

**Seharusnya:** kalau mata uang terdeteksi IDR, contohnya `+62 812 3456 xxxx`. Kalau USD,
`+1 (415) 555-xxxx`. Ganti bahasa UI ke Inggris — placeholder telepon **tidak boleh ikut berubah**.
Bahasa tidak memberi tahu apa pun tentang di mana orang tinggal; yang menentukan adalah mata uang.

Ekor nomornya harus tetap `xxxx` — placeholder yang tampak seperti nomor asli bisa jadi milik orang
sungguhan, dan ia dipajang di ribuan layar.

- [ ] Lolos

### 1.3 Mengadopsi vault yang sudah ada (kasus install ulang)

Ini yang paling penting di bagian ini. Salah di sini artinya menimpa data orang.

1. Salin vault yang sudah berisi data ke `~/Desktop/qa/v-adopsi`.
2. Hapus pointer, reload.
3. Di onboarding, pilih folder `v-adopsi`.

**Seharusnya:** app **mengadopsi** data itu — invoice lama muncul di History, profil bisnis
ter-prefill dari vault, dan **tidak ada** klien/katalog "(Contoh)" yang diseed.

**Bentuk kegagalannya:** app menyapamu dengan vault kosong dan menimpa file itu pada penyimpanan
berikutnya. Kalau History kosong padahal file berisi, **hentikan dan lapor**.

- [ ] Lolos

### 1.4 Menolak folder di dalam vault lain

Di onboarding (atau Settings → Bisnis → Tambah), pilih `~/Desktop/qa/v-baru/Backups`.

**Seharusnya:** ditolak dengan pesan "folder berada di dalam vault lain" (bukan crash, bukan
membuat vault bersarang). Coba juga folder **induknya** (`~/Desktop/qa`) setelah `v-baru` jadi
vault — juga harus ditolak.

- [ ] Lolos

---

## 2. Editor — kuantitas dan harga

Bagian ini menguji perubahan hari ini. Baca angkanya, jangan cuma lihat form-nya tidak error.

### 2.1 Qty tidak boleh pecahan

Di kolom **Qty** sebuah baris item, coba semua ini:

| Yang kamu lakukan | Yang seharusnya terjadi |
|---|---|
| Tekan tombol `.` atau `,` | **Tidak ada yang terketik.** Titiknya ditolak di tombol. |
| Tekan `e`, `+`, `-` | Sama — tidak terketik. |
| Paste teks `2.5` | Kolom jadi `25`, bukan `2.5`. (Digitnya diambil, pemisahnya dibuang.) |
| Ketik `0` | Jadi `1`. Tak seorang pun bermaksud menagih nol buah barang yang baru ia ketik. |
| Kosongkan kolomnya | Jadi `1`. |
| Panah atas/bawah | Naik/turun satu-satu. |

**Kenapa ini diuji sekeras itu:** `<input type="number">` melaporkan nilai kosong untuk apa pun yang
dianggapnya bukan angka valid — dan `2.` termasuk. Jadi sebelum diperbaiki, mengetik "2.5" membuat
kolom berkedip ke `1` di tengah pengetikan. Kalau kamu melihat kedipan itu lagi, perbaikannya
mundur.

- [ ] Lolos

### 2.2 Harga — input mata uang

Dengan mata uang **USD**:

| Ketik | Tampil | Tersimpan di vault |
|---|---|---|
| `19.99` | `19.99` | `1999` |
| `19.9` | `19.9` (saat mengetik) | `1990` |
| `1234.567` | `1,234.56` (desimal ke-3 dipotong) | `123456` |
| `0.01` | `0.01` | `1` |

Dengan mata uang **IDR** (tidak ada sen):

| Ketik | Tampil | Tersimpan |
|---|---|---|
| `2500000` | `2.500.000` | `2500000` |
| `2.500.000` | `2.500.000` | `2500000` |
| `19.99` | `1.999` — titik adalah pemisah ribuan, bukan desimal | `1999` |

Lalu: klik di tengah angka `2.500.000`, ketik satu digit. **Kursor tidak boleh melompat** ke ujung.
Salin (⌘C) isinya dan tempel di TextEdit — yang tersalin harus `2500000` bersih, tanpa titik.

- [ ] Lolos

### 2.3 Bug lama yang tidak boleh kembali

Ini alasan seluruh perubahan hari ini. Mata uang **USD**:

Buat satu baris: **qty 3**, **harga 19.99**. Nyalakan **diskon 10% (persen)**. Nyalakan **PPN 8,5%**.

**Yang seharusnya terbaca, persis:**

```
Subtotal   $59.97
Diskon     $6.00
Pajak      $4.59
TOTAL      $58.56
```

Ambil kalkulator: `59.97 − 6.00 + 4.59 = 58.56`. **Bagian-bagiannya harus menjumlah jadi totalnya.**
Itulah properti yang dicek klienmu saat ia curiga.

**Bentuk kegagalannya:** total apa pun yang berakhiran digit aneh, atau bagian yang tidak menjumlah.
Sebelum perbaikan, `3 × 19.99` bernilai `59.97000000000001` di memori — layar membulatkannya, jadi
kesalahannya tak terlihat sampai ia menumpuk lewat diskon dan pajak.

- [ ] Lolos

### 2.4 Pembulatan setengah

Satu baris: **qty 1**, **harga 0.01** (USD). Diskon **50%**.

Setengah sen tidak ada. **Seharusnya:** diskon `$0.01`, total `$0.00` — dibulatkan **menjauhi nol**,
bukan dipotong jadi 0.

- [ ] Lolos

### 2.5 Diskon flat lebih besar dari subtotal

Satu baris: **qty 1**, **harga 19.99** (USD). Diskon **flat 999**. PPN 10%.

**Seharusnya:** diskon dijepit ke `$19.99`, pajak `$0.00`, total `$0.00`. **Tidak boleh negatif.**

- [ ] Lolos

### 2.6 Contoh IDR

Satu baris: **qty 3**, **harga 333.333**. Diskon **10%**. PPN **11%**.

```
Subtotal   Rp 999.999
Diskon     Rp 100.000
Pajak      Rp 99.000
TOTAL      Rp 998.999
```

Dan yang lebih realistis — dua baris: `1 × 2.500.000` dan `3 × 750.000`, PPN 11%, tanpa diskon:

```
Subtotal   Rp 4.750.000
Pajak      Rp 522.500
TOTAL      Rp 5.272.500
```

- [ ] Lolos

### 2.7 Angka besar

Satu baris: **qty 999**, **harga 1234.56** (USD). Subtotal harus `$1,233,325.44` — tepat, tanpa
pembulatan aneh di digit terakhir.

- [ ] Lolos

---

## 3. Editor — sisanya

### 3.1 Baris item

Tambah beberapa baris. Uji: seret untuk menyusun ulang (desktop), panah naik/turun (mobile layout —
sempitkan jendela), hapus baris, dan **isi dari katalog**.

Saat memilih dari katalog: kalau ada baris kosong (deskripsi kosong **dan** harga nol), katalog
harus mengisi **baris itu**, bukan menambah baris baru.

- [ ] Lolos

### 3.2 Klien

Pilih klien tersimpan; ganti; kosongkan. Pastikan alamat multi-baris tampil utuh di preview.

- [ ] Lolos

### 3.3 Nomor invoice

Settings → Penomoran. Ubah formatnya, misalnya `{PREFIX}/{YYYY}/{MM}/{SEQ}`, padding 4.

**Seharusnya:** invoice baru mengikuti format itu, dan urutannya melanjutkan nomor terakhir dalam
lingkup yang sama — bukan mengulang dari 1. Klik token di Settings untuk menyalinnya; toast muncul.

- [ ] Lolos

### 3.4 Simpan menggerbangi Ekspor

Buat invoice baru, jangan simpan. Lihat toolbar.

**Seharusnya:** tombol Ekspor PDF/PNG **mati**, dengan tooltip "simpan dulu". Setelah Simpan, ia
hidup. Ubah sesuatu lagi → status kembali "belum tersimpan" dan Ekspor mati lagi.

Ini disengaja: mengekspor draf yang belum tersimpan akan membakar nomor invoice yang belum benar-benar
ada.

- [ ] Lolos

### 3.5 Modal sukses (simpan pertama)

Simpan pertama kali dalam vault baru → modal perayaan. Simpan kedua dan seterusnya → toast biasa.

- [ ] Lolos

---

## 4. Daftar invoice

1. Cari berdasarkan nomor dan nama klien.
2. Filter status: Semua / Belum bayar / Lewat jatuh tempo / Lunas.
3. Urutkan: Terbaru / Terlama / **Jumlah** / Jatuh tempo.
4. Tandai lunas (pil status) — di daftar **dan** di toolbar editor; keduanya harus sinkron.
5. Duplikat invoice → nomor baru, isi sama.
6. Hapus → dialog konfirmasi in-app (bukan dialog bawaan browser).
7. Paginasi (>20 invoice).

**Perhatikan khusus urutan "Jumlah":** kolom total di daftar sekarang memakai `calcTotals` yang sama
dengan editor. Dulu daftar ini punya **salinan kedua** rumus uangnya, dan salinan itu sudah mulai
menyimpang. Buka salah satu invoice dan bandingkan totalnya dengan yang tertulis di daftar — **harus
identik**.

- [ ] Lolos

---

## 5. Dashboard

Rentang waktu, toggle metrik bulanan, tooltip mengikuti kursor, dan **klik-tembus**: klik sebuah bulan
atau segmen status → mendarat di daftar invoice dengan chip filter aktif. Klik X di chip → filter
bersih.

Jumlah di dashboard harus cocok dengan jumlah di daftar untuk filter yang sama.

- [ ] Lolos

---

## 6. Klien & katalog

Tambah, ubah, hapus, cari, di kedua halaman. Untuk katalog, harga memakai input mata uang yang sama —
uji ulang kasus 2.2 secara singkat di sini.

Hapus klien yang sedang dipakai invoice tersimpan → invoice lamanya **tidak boleh berubah** (ia
menyimpan salinan datanya sendiri).

- [ ] Lolos

---

## 7. Settings

| Bagian | Yang diuji |
|---|---|
| Profil | Nama, email, telepon, alamat, **logo** (unggah PNG/SVG, ganti, hapus), warna aksen, mode kop surat (logo vs nama teks) |
| Pembayaran | Nama bank, nomor rekening, atas nama — muncul di preview |
| Default | Termin pembayaran, PPN default, catatan default → **hanya** mempengaruhi invoice **baru** |
| Format | Format tanggal (5 pilihan) — cek di preview |
| Palet | 12 palet — ganti dan lihat seluruh UI berubah |
| Folder ekspor | Ganti; hapus foldernya dari Finder lalu ekspor lagi → harus pulih sendiri |
| Template | Grid template; Free hanya bisa memilih Minimal |

### 7.1 Kunci mata uang

Simpan minimal satu invoice, lalu Settings → coba ganti mata uang.

**Seharusnya:** ada peringatan yang menyebut jumlah invoice yang terdampak, dan mengharuskan
konfirmasi eksplisit. Alasannya jujur: harga tersimpan tidak dikonversi — mengganti mata uang
mengubah arti angka yang sama.

- [ ] Lolos

### 7.2 Gerbang Pro

Sebagai **Free** (matikan toggle Dev Pro):

1. Buka pemilih template → template premium **terlihat** dan bisa dipratinjau.
2. Pilih salah satunya → dialog upgrade muncul.
3. Batalkan → template tetap Minimal.
4. Sekarang **paksa lewat pintu belakang**: tutup app, ubah `template` di `invois-data.json` jadi
   `"aurora"`, buka lagi.

**Seharusnya:** preview dan ekspor tetap **Minimal**. Gerbangnya ada di render, bukan cuma di UI
pemilih.

- [ ] Lolos

---

## 8. Banyak bisnis (vault ganda)

1. Settings → Bisnis → Tambah → `~/Desktop/qa/v-bisnis2`.
2. Berpindah antar bisnis → konfirmasi, lalu seluruh data berganti (klien, katalog, invoice, profil,
   penomoran).
3. Menambahkan folder yang sudah terdaftar → ditolak ("folder sudah dipakai").
4. Hapus sebuah bisnis dari daftar → **file di disk tidak boleh ikut terhapus.** Pastikan dengan
   Finder.
5. Pindahkan lokasi vault → folder `Exports` default ikut pindah.

- [ ] Lolos

---

## 9. Ekspor

### 9.1 PDF

Ekspor invoice 1 halaman, lalu yang **lebih dari 2 halaman** (tambah ~30 baris item).

**Seharusnya:** teks bisa diseleksi. Seleksi satu sel di tabel tidak menyeret seluruh baris. Salin-tempel
ke Notes menghasilkan tabel yang rapi. Buka di Chrome dan Preview — keduanya harus baik.

### 9.2 Font — ini soal lisensi, bukan estetika

```bash
npm run pdf:fonts -- "<path/ke/hasil.pdf>"
```

**Seharusnya:** hanya Inter dan Roboto Mono. **Tidak boleh ada** `.SFNS`, `SFPro`, atau nama font
Apple apa pun. Font SF boleh digambar di layar, tapi **tidak boleh disematkan** ke dokumen yang
didistribusikan — itu melanggar lisensi Apple.

`strings | grep BaseFont` **tidak** akan melihatnya (font-nya terkompresi di dalam stream). Pakai
skripnya.

### 9.3 PNG

Ekspor PNG; cek ketajaman teks dan tidak ada tepi terpotong.

### 9.4 Nama file bentrok

Ekspor invoice yang sama dua kali ke folder yang sama → file kedua dapat nama unik, tidak menimpa.

- [ ] Lolos

---

## 10. Migrasi vault (format lama → 3)

Sudah diuji lewat dry-run pada 789 invoice nyata: semua total identik sebelum dan sesudah. Yang
**belum** terbukti oleh data nyata itu: **nol** dari 789 invoice memakai **diskon flat** — dan itu
justru jalur paling berbahaya. Jadi buat kasusnya sendiri.

1. Tutup app.
2. Ambil vault format lama (atau buat: hapus `__invois` dari file dan ubah `priceMinor` kembali jadi
   `price` dengan nilai desimal).
3. Tambahkan satu invoice dengan `"discountType": "flat"`, `"discount": 50`, mata uang USD.
4. Buka app.

**Seharusnya:** diskonnya terbaca **$50,00** — bukan **$0,50**, bukan **$5.000,00**.

Di file, setelah penyimpanan berikutnya: `"discountValue": 5000` dan tidak ada lagi field
`"discount"`.

**Kenapa ini yang paling rawan:** angka diskon yang sudah diskalakan tidak bisa dibedakan dari yang
belum — `5000` masuk akal sebagai "$50 dalam sen" maupun "$5.000 yang belum diskalakan". Migrasinya
dulu benar-benar menskalakan dua kali saat diuji. Penggantian nama field itulah penanda yang
mencegahnya.

### 10.1 Buka-lalu-tutup tidak boleh menulis apa pun

Salin vault format 2. Buka app, **jangan sentuh apa pun**, tutup.

**Seharusnya:** file aslinya **tidak berubah sama sekali** (`md5 sebelum == md5 sesudah`), dan masih
bisa dibaca oleh build kemarin. Migrasi terjadi di memori; ia hanya mendarat ke disk saat kamu
benar-benar menyimpan sesuatu.

```bash
md5 ~/Desktop/qa/v-lama/invois-data.json   # sebelum dan sesudah
```

- [ ] Lolos

---

## 11. Kasus error dan tepi — vault

Bagian ini menguji apa yang terjadi saat file datanya salah. Prinsip yang dipegang app: **lebih baik
menolak bekerja daripada menimpa sesuatu yang gagal dibaca.**

Untuk semuanya: **tutup app dulu**, ubah file, baru buka.

### 11.1 JSON rusak

Rusak `invois-data.json` (hapus satu kurung kurawal).

**Seharusnya:** app memuat dari `.bak1` dan menampilkan **banner kuning permanen** di atas: "Data
file could not be read. Showing a backup." Banner **tidak bisa ditutup**. Sekarang ketik sesuatu,
tunggu, tutup app.

**File rusak itu harus masih persis sama.** App menolak menulis apa pun. Kalau file rusaknya tertimpa,
itu bug serius — lapor.

- [ ] Lolos

### 11.2 JSON valid, bentuk salah

Ubah `"invois_history"` dari array jadi objek: `"invois_history": { "oops": true }`.

**Seharusnya:** banner mode aman muncul, History kosong **tapi tidak ditulis**. Tanpa penjagaan ini,
vault berisi 300 invoice akan tampak seperti vault baru yang kosong — dan penyimpanan berikutnya
mengabadikan kekosongan itu.

- [ ] Lolos

### 11.3 Vault dari masa depan

Ubah formatnya jadi `"format": 99` dan tambahkan field karangan.

**Seharusnya:** mode aman, tidak ada penulisan, field karangan itu tetap utuh saat kamu periksa lagi.
App yang lebih tua **tidak boleh menebak** isi file dari app yang lebih baru — menebak berarti
membuang field yang tidak dikenalnya, lalu menyimpan kehilangan itu.

- [ ] Lolos

### 11.4 Folder vault hilang

Saat app **berjalan**, pindahkan folder vault-nya lewat Finder.

**Seharusnya:** layar pemulihan ("vault tidak ditemukan") menawarkan untuk mencari lokasinya —
**bukan** app kosong yang lalu menyimpan kekosongan itu ke pointer.

- [ ] Lolos

### 11.5 Backup memang ada

Simpan beberapa kali, lalu lihat folder vault.

**Seharusnya:** `.bak1`, `.bak2`, `.bak3` (rotasi per simpan) **dan** `Backups/invois-YYYY-MM-DD.json`
(snapshot harian, satu per hari).

Yang **paling penting**: file utamanya **tidak boleh pernah hilang**, bahkan sesaat. Rotasi
menyalin, tidak memindahkan. Ini bukan kehati-hatian teoretis — pada 13 Juli 2026 versi lama kode ini
memindahkan file utama untuk merotasinya, dan sebuah reload di celah itu mengambil satu-satunya
salinan yang tersisa.

Dan perhatikan: sekadar meminimalkan/mengembalikan jendela berkali-kali **tidak boleh** merotasi
backup. Dulu bisa — artinya "3 backup" sebenarnya berarti "3 kali sembunyikan jendela".

- [ ] Lolos

### 11.6 Data diedit tangan yang tetap valid

Di file, ubah satu qty jadi `2.5` dan satu harga jadi `-100`.

**Seharusnya:** qty pecahan dipotong (berkontribusi 2, bukan 2,5), harga negatif dianggap 0. Tidak
crash, tidak total negatif.

- [ ] Lolos

---

## 12. Jendela, menu, dan hal-hal Electron

1. **Klik kanan** di mana saja → menu konteks (Reload, Inspect di dev).
2. **Menu native** → File → New Invoice; Settings; navigasi.
3. **Maksimalkan** jendela → ada kedipan hitam sesaat (**bug yang sudah diketahui dan diparkir** —
   celah native WKWebView/NSWindow; catat saja, jangan lapor sebagai baru).
4. Ikon Dock dan nama di **About** harus "Invois", bukan "Electron".
5. Tutup dengan ⌘Q di tengah pengetikan → yang sudah kamu simpan harus utuh saat dibuka lagi.

- [ ] Lolos

---

## 13. Bahasa

Ganti bahasa (ID ⇄ EN) dan telusuri: onboarding, editor, semua dialog, Settings, toast, dan invoice
yang tercetak.

**Yang dicari:** teks yang tidak ikut berganti, dan **key mentah** yang bocor ke layar (misalnya
`inv.dueLabel` alih-alih "Jatuh tempo:"). Test i18n otomatis menjamin kedua kamus punya key yang sama,
tapi ia tidak bisa tahu apakah sebuah string dipanggil lewat `t()` sama sekali.

Perhatikan juga tanggal: `1 Januari 2026` (ID) vs `January 1, 2026` (EN).

- [ ] Lolos

---

## Cara melaporkan kegagalan

Sebutkan: langkah persisnya, yang kamu lihat, yang kamu harapkan, dan — kalau menyangkut uang atau
vault — **lampirkan file `invois-data.json`-nya** (atau salin bagian yang relevan). Untuk bug uang,
angka mentah di file jauh lebih berguna daripada tangkapan layar: layar sudah dibulatkan, file
tidak.
