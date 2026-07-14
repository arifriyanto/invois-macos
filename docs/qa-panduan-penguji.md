# Invois — panduan mencoba aplikasi

Terima kasih sudah mau mencoba. Kamu **tidak perlu tahu apa pun soal pemrograman** untuk mengerjakan
ini. Yang dibutuhkan cuma ketelitian dan kejujuran: kalau ada yang terasa aneh, itu layak dilaporkan,
sekecil apa pun.

**Waktu:** sekitar 45–60 menit kalau dikerjakan santai.

Kerjakan **urut dari atas**. Tiap bagian memakai hasil bagian sebelumnya, jadi kalau melompat, kamu
akan menemui layar yang belum siap.

---

## Yang paling ingin kami tahu

Invois membuat faktur (invoice) untuk klienmu. Artinya ada dua hal yang tidak boleh salah, sedikit
pun:

**Angkanya.** Faktur yang salah hitung akan dikirim ke orang lain. Jadi saat panduan ini menyebut
angka yang harus muncul, tolong **benar-benar dibaca dan dicocokkan**, bukan sekadar dilihat sekilas.
Kalau ada satu sen yang meleset, itu bug besar — bukan bug kecil.

**Datamu.** Semua data tinggal di satu file di komputermu, bukan di internet. Kalau aplikasi
kehilangan atau menimpa data, itu kegagalan paling serius yang bisa terjadi. Kalau daftar fakturmu
tiba-tiba kosong padahal seharusnya berisi — **berhenti, jangan simpan apa pun, dan langsung lapor.**

---

## Sebelum mulai

Aplikasi akan meminta sebuah **folder** untuk menyimpan datanya. Siapkan folder kosong yang boleh
dibuang, misalnya di Desktop, beri nama `uji-invois`.

Selama panduan ini, **jangan pakai folder yang berisi data yang kamu sayangi.**

**Satu hal penting sebelum mulai:** Bagian 1 sampai 3 harus dikerjakan sebagai pengguna **gratis**.
Kalau aplikasi yang kamu terima sudah dalam mode **Pro**, beberapa pengujian tidak akan berjalan sama
sekali — dan celakanya, ia akan tampak seolah-olah lolos.

Cara memastikan: buka **Settings**, cari tab **Dev**, dan pastikan tombol **Pro** dalam keadaan
**mati**. Kalau kamu tidak menemukan tab itu, tanyakan ke Arif.

Kalau nanti kamu ingin mengulang dari awal, minta bantuan Arif untuk mereset — dan ingatkan dia untuk
**mematikan Pro juga**, karena mereset data saja tidak otomatis mengembalikanmu ke versi gratis.

---

## Bagian 1 — Pertama kali membuka

### 1.1 Perkenalan

Saat pertama dibuka, aplikasi akan memandumu dua langkah.

**Langkah pertama** meminta folder tempat data disimpan. Pilih folder `uji-invois` tadi.

**Langkah kedua** meminta profil bisnismu: logo, nama bisnis, email, nomor telepon, dan mata uang.
Pilih **USD (Dollar)** — kita pakai itu sepanjang panduan, karena dollar punya sen, dan sen itulah
yang memperlihatkan apakah hitungannya benar.

**Yang harus terjadi:** setelah selesai, kamu langsung mendarat di layar pembuatan faktur, dan ada
**titik berdenyut** yang menuntunmu: pilih klien → isi item → simpan.

Kamu juga akan menemukan satu contoh klien dan satu contoh item, keduanya diberi label **(Sample)**.
Itu memang sengaja, supaya kamu punya sesuatu untuk dipilih.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 1.2 Contoh nomor telepon mengikuti mata uang

Perhatikan kolom **nomor telepon** di langkah kedua. Di dalamnya ada contoh samar (placeholder).

Coba ganti-ganti pilihan **mata uang** dan lihat contoh nomornya berubah:

| Mata uang | Contoh nomor yang muncul |
|---|---|
| IDR (Rupiah) | `+62 812 3456 xxxx` |
| USD (Dollar) | `+1 (415) 555-xxxx` |
| SGD | `+65 8123 xxxx` |
| EUR | `+49 30 1234 xxxx` |
| GBP | `+44 7700 900xxx` |

Ekornya harus tetap huruf `x`, tidak pernah jadi angka lengkap. Alasannya sederhana: nomor contoh
yang terlihat asli bisa saja **benar-benar milik seseorang**, dan contoh ini muncul di layar ribuan
orang. Kami tidak mau ada orang asing ditelepon karena itu.

Setelah selesai mencoba, kembalikan ke **USD**, dan tuntaskan sampai selesai.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

---

## Bagian 2 — Angka (bagian terpenting)

Sekarang kamu ada di layar pembuatan faktur. **Belum perlu disimpan.** Kita akan mengetik angka dan
membaca hasilnya.

### 2.1 Jumlah barang harus bilangan bulat

Di kolom **Qty** (jumlah), coba semua ini:

| Yang kamu lakukan | Yang harus terjadi |
|---|---|
| Ketik tanda titik `.` atau koma `,` | **Tidak ada yang muncul.** Tandanya ditolak. |
| Tempel (paste) tulisan `2.5` | Kolomnya jadi `25`, bukan `2.5` |
| Ketik `0` | Berubah jadi `1` |
| Kosongkan kolomnya | Berubah jadi `1` |
| Tekan panah atas/bawah | Naik-turun satu-satu |

Ini disengaja: satu faktur menagih "3 kali revisi logo", bukan "2,5 kali revisi logo". Jumlah adalah
hitungan benda, dan benda tidak setengah.

**Yang perlu kamu awasi:** saat mengetik, angkanya **tidak boleh berkedip** ke angka lain sesaat.
Kalau kamu melihat kedipan, tolong laporkan.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 2.2 Kolom harga

Di kolom **Harga**, ketik `19.99`. Lalu coba `1234.567` — harusnya jadi `1,234.56` (angka desimal
ketiga dibuang, karena tidak ada pecahan sen di bawah itu).

Sekarang klik **di tengah-tengah** angka `1,234.56` lalu ketik satu angka. Kursornya **tidak boleh
melompat** ke ujung.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 2.3 Hitungan yang harus tepat

**Ini pengujian paling penting di seluruh panduan.** Isi satu baris item begini:

- Qty: **3**
- Harga: **19.99**
- Nyalakan **Diskon**, pilih **%**, isi **10**
- Nyalakan **Pajak**, isi **8.5**

**Yang harus muncul, persis seperti ini:**

```
Subtotal   $59.97
Diskon     $6.00
Pajak      $4.59
TOTAL      $58.56
```

Sekarang ambil kalkulator dan periksa sendiri: **59,97 − 6,00 + 4,59 = 58,56**. Angka-angka yang
tertulis harus benar-benar menjumlah jadi totalnya.

**Kenapa serewel ini:** dulu komputer menyimpan `3 × 19,99` sebagai `59,97000000000001` — layar
membulatkannya jadi terlihat benar, tapi kesalahannya menumpuk diam-diam setiap kali dikenai diskon
dan pajak. Kalau kamu melihat angka dengan ekor aneh, atau bagian-bagian yang **tidak** menjumlah
jadi total, itu tanda masalahnya kembali.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 2.4 Tiga hitungan lain

Ganti isinya dan periksa satu per satu:

**(a)** Qty `1`, harga `0.01`, diskon `50%` → Diskon `$0.01`, Total `$0.00`.
(Setengah sen tidak ada, jadi ia dibulatkan ke atas.)

**(b)** Qty `1`, harga `19.99`, diskon **nominal** (bukan %) `999`, pajak `10%` → Diskon berhenti di
`$19.99`, Total `$0.00`. **Tidak boleh minus.** Diskon tidak bisa lebih besar dari belanjaannya.

**(c)** Qty `999`, harga `1234.56` → Subtotal `$1,233,325.44`. Tepat, tanpa angka aneh di ekornya.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

---

## Bagian 3 — Menyimpan, dan batas versi gratis

### 3.1 Harus simpan dulu, baru bisa ekspor

Lihat tombol **PDF** dan **PNG** di atas. Sebelum fakturnya disimpan, keduanya **mati** (tidak bisa
diklik).

Setelah kamu tekan **Simpan**, keduanya hidup. Lalu ubah sesuatu lagi → statusnya kembali "belum
tersimpan" dan tombol ekspor mati lagi.

Ini disengaja, supaya kamu tidak mengirim faktur bernomor yang sebenarnya belum tercatat.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 3.2 Faktur pertama

Rapikan fakturnya jadi masuk akal: pilih klien **(Sample)**, dan tulis satu item dengan deskripsi
**baru** yang belum pernah ada — misalnya `Audit halaman arahan`. Isi qty dan harga sesukamu. Simpan.

**Tiga hal harus terjadi sekaligus:**

1. Titik-titik penuntun (yang berdenyut) **padam**, dan tidak muncul lagi.
2. Muncul **jendela ucapan selamat**.
3. Deskripsi item tadi **otomatis masuk ke daftar Katalog**. Cek di halaman Katalog — harusnya ada di
   sana beserta harganya. (Ini fitur: barang yang pernah kamu tagih akan siap dipakai lagi nanti.)

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 3.3 Simpan ulang berbeda dari faktur baru

Ubah sedikit faktur tadi, lalu simpan lagi.

**Yang harus terjadi:** hanya notifikasi kecil di bawah — **bukan** jendela ucapan selamat lagi.

Sekarang buat faktur **baru** (yang kedua) dan simpan → jendela ucapan selamat **muncul lagi**. Itu
benar: ia menyambut tiap faktur baru, bukan cuma yang pertama seumur hidup.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 3.4 Katalog tidak menggandakan

Di faktur kedua, pakai deskripsi item yang **sudah ada** di katalog (boleh beda huruf besar-kecil),
tapi dengan harga berbeda. Simpan.

**Yang harus terjadi:** katalog **tidak** bertambah entri kembar, dan harga yang lama **tidak**
tertimpa.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 3.5 Batas 3 faktur di versi gratis

> **Periksa dulu:** Settings → tab Dev → tombol **Pro** harus **mati**. Kalau menyala, pengujian ini
> dan dua berikutnya tidak akan terjadi sama sekali — dan akan tampak lolos padahal tidak diuji.

Versi gratis hanya boleh menyimpan **3 faktur**. Sekarang kamu punya 2. Buat dan simpan faktur
**ketiga** — masih boleh.

Lalu coba buat yang **keempat**.

**Yang harus terjadi:** layar pembuatan **tidak terbuka**; muncul tawaran upgrade ke Pro.

Yang **tidak boleh** terjadi: faktur lamamu hilang atau disembunyikan. Semuanya harus tetap ada, dan
kamu harus tetap bisa **membuka dan mengubah** faktur lama, termasuk menyimpannya lagi. Yang dibatasi
hanya membuat yang **baru**.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 3.6 Desain faktur yang berbayar

Buka pemilih **template** (desain faktur).

**Yang harus terjadi:** semua desain **bisa kamu lihat pratinjaunya**, gratis. Tapi begitu kamu
**memilih** salah satu yang berlabel Pro, muncul tawaran upgrade. Batalkan → desainnya tetap yang
gratis (Minimal).

Kami ingin kamu bisa melihat dulu apa yang kamu bayar. Yang dikunci adalah memakainya, bukan
melihatnya.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

---

## Bagian 4 — Menyalakan Pro (untuk pengujian)

Mulai sini kamu butuh versi Pro. Ini **khusus pengujian**, bukan yang akan dilihat pengguna asli.

Buka **Settings** → cari tab **Dev** (ikon kunci inggris) → nyalakan **Pro**.

Kalau kamu tidak menemukan tab itu, tanya Arif — kamu mungkin memakai versi yang salah.

Biarkan Pro menyala sampai selesai.

---

## Bagian 5 — Mengekspor faktur

### 5.1 PDF

Ekspor sebuah faktur ke PDF. Buka hasilnya.

**Yang harus terjadi:** teksnya **bisa diseleksi** dengan kursor (bukan gambar). Coba seleksi satu
kolom di tabel — seharusnya tidak menyeret seluruh baris. Coba salin-tempel isi tabelnya ke aplikasi
Notes; hasilnya harus rapi.

Lalu buat faktur panjang (tambahkan sekitar 30 baris item) dan ekspor lagi — hasilnya lebih dari 2
halaman. Periksa hal yang sama.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 5.2 PNG dan nama file

Ekspor ke PNG — periksa tulisannya tajam dan tidak ada bagian yang terpotong.

Lalu ekspor **faktur yang sama** dua kali ke folder yang sama. File kedua harus dapat nama baru,
**tidak menimpa** yang pertama.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

---

## Bagian 6 — Pengaturan

Buka **Settings**. Ada delapan bagian; telusuri semuanya. Beberapa yang perlu perhatian khusus:

### 6.1 Ganti bahasa

Ganti bahasa aplikasi ke **Indonesia**, lalu telusuri seluruh layar.

**Yang dicari:** tulisan yang tidak ikut berganti bahasa, atau tulisan aneh seperti kode
(`inv.dueLabel`) yang bocor ke layar. Periksa juga tanggal di pratinjau faktur: harus `1 Januari 2026`
(Indonesia), bukan `January 1, 2026`.

**Lalu, yang khusus:** kembali ke **Profil bisnis** dan lihat contoh nomor telepon.

**Contoh nomornya TIDAK boleh berubah** hanya karena kamu mengganti bahasa.

Kenapa? Karena bahasa tidak memberi tahu apa pun tentang di mana seseorang tinggal. Freelancer
Indonesia yang lebih suka aplikasi berbahasa Inggris tetap punya nomor Indonesia. Yang menentukan
contoh nomor adalah **mata uang**, bukan bahasa.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 6.2 Mata uang terkunci

Kamu sudah punya beberapa faktur tersimpan. Coba ganti mata uangnya.

**Yang harus terjadi:** muncul peringatan yang menyebut berapa faktur yang terdampak, dan kamu harus
menyetujuinya secara sadar.

Alasannya jujur: harga yang sudah tersimpan **tidak ikut dikonversi**. Angka `19.99` tetap `19.99`,
cuma artinya berubah dari dollar jadi rupiah. Batalkan saja.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 6.3 Penomoran faktur

Ada beberapa "token" yang bisa kamu susun jadi format nomor, misalnya `{PREFIX}-{YYYY}-{SEQ}`. Klik
salah satu token untuk menyalinnya.

Coba ubah formatnya, lalu buat faktur baru: nomornya harus mengikuti format barumu, dan urutannya
**melanjutkan** yang terakhir, bukan mengulang dari 1.

Lalu coba token `{CLIENT}`. Masukkan ke format, buat faktur, lalu **ganti kliennya** — nomornya harus
ikut berubah. Ini yang paling mungkin bermasalah, jadi tolong diperiksa serius.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 6.4 Warna tampilan

Ada enam pilihan warna: Corporate, Cool Neutral, Amber Cream, Ocean, Jewel, dan **Midnight**.

**Midnight** yang paling perlu diperhatikan — ia satu-satunya tema **gelap**. Nyalakan, lalu telusuri
seluruh aplikasi dan cari **tulisan yang tenggelam** ke latarnya (susah dibaca, warnanya terlalu mirip
latar).

Dan yang penting: **pratinjau fakturnya harus tetap putih.** Warna tema mengubah tampilan aplikasi,
bukan dokumen yang kamu kirim ke klien.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

---

## Bagian 7 — Daftar faktur & halaman utama

Supaya bagian ini ada isinya, minta Arif memberimu **folder data contoh** yang sudah berisi ratusan
faktur, lalu tambahkan sebagai bisnis kedua (Settings → Data → Tambah bisnis) dan pindah ke sana.

### 7.1 Berpindah bisnis

Setelah pindah, **semuanya** harus berganti: daftar klien, katalog, faktur, profil bisnis, penomoran.

**Yang paling penting:** kalau ada **satu saja** data dari bisnis lamamu yang nyelonong muncul di sini
— satu klien, atau profil bisnismu yang lama — itu masalah serius. Laporkan.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 7.2 Daftar faktur

Coba semuanya: cari (pakai nomor faktur **dan** nama klien), saring berdasarkan status, urutkan
(terbaru, terlama, **jumlah**, jatuh tempo), pindah halaman, tandai lunas, gandakan, hapus.

**Satu hal untuk diperiksa teliti:** buka sebuah faktur, lihat totalnya, lalu tutup dan lihat total
faktur yang sama **di daftar**. Kedua angka itu harus **persis sama**.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 7.3 Halaman utama (Home)

Coba rentang waktu (3M/6M/12M/YTD) dan pilihan grafik. Arahkan kursor ke batang grafik untuk melihat
angkanya.

Ambil satu bulan, dan cocokkan dengan tangan: total bulan itu di grafik harus sama dengan jumlah
faktur bertanggal bulan itu di halaman daftar.

> Catatan: mengklik batang grafik **tidak melakukan apa-apa**. Itu memang belum ada — bukan bug yang
> perlu kamu laporkan.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

### 7.4 Klien & katalog

Tambah, ubah, hapus, cari — di kedua halaman.

Lalu satu hal khusus: **hapus seorang klien yang dipakai di faktur lama.** Buka faktur lamanya.

**Data klien di faktur itu harus tetap utuh.** Faktur adalah dokumen — ia menyimpan salinan datanya
sendiri. Menghapus klien tidak boleh mengubah faktur yang sudah terlanjur dikirim.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

---

## Bagian 8 — Jendela dan menu

1. **Klik kanan** di mana saja → muncul menu (Reload, dll).
2. Coba pintasan papan ketik:

   | Tombol | Yang harus terjadi |
   |---|---|
   | ⌘, | Settings terbuka |
   | ⌘N | Faktur baru |
   | ⌘1 / ⌘2 / ⌘3 / ⌘4 | Home / Faktur / Klien / Katalog |
   | ⌘B | Panel kiri menguncup dan mengembang |

3. Ikon di Dock dan nama di menu **About** harus tertulis **Invois** — bukan "Electron".
4. Uncupkan panel kiri, lalu tutup dan buka lagi aplikasinya: panelnya harus tetap menguncup.
5. Tutup aplikasi saat sedang mengetik, lalu buka lagi: semua yang sudah kamu **simpan** harus utuh.

> Catatan: saat jendela dimaksimalkan, ada **kedipan hitam** sesaat. Itu **sudah kami ketahui** dan
> belum diperbaiki. Tidak perlu dilaporkan.

- [ ] Sesuai
- [ ] Ada yang aneh: ______________________

---

## Cara melaporkan

Untuk tiap masalah, tuliskan:

1. **Nomor bagiannya** (misalnya "2.3").
2. **Apa yang kamu lakukan**, selangkah demi selangkah, sampai orang lain bisa mengulanginya.
3. **Apa yang kamu lihat.**
4. **Apa yang kamu harapkan.**
5. **Tangkapan layar**, kalau memungkinkan.

Kalau masalahnya soal **angka**, tulis angkanya apa adanya — jangan dibulatkan atau ditulis ulang dari
ingatan. Satu sen yang meleset adalah petunjuk penting.

Dan sekali lagi: kalau daftar fakturmu tiba-tiba tampak **kosong** padahal seharusnya berisi —
**berhenti di situ, jangan menyimpan apa pun, dan langsung hubungi Arif.** Menyimpan di keadaan itu
bisa membuat data yang sebenarnya masih ada jadi benar-benar hilang.

Tidak ada laporan yang terlalu remeh. Kalau kamu ragu apakah sesuatu itu bug atau memang begitu
seharusnya — laporkan saja. Keraguanmu itu sendiri sudah informasi: artinya ada yang tidak jelas.
