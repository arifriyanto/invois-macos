# Catatan hasil uji

## Aturan pokoknya

**"Lolos" tidak pernah berdiri sendiri. Yang ada hanya "lolos pada commit ini, di build ini."**

Kode berubah tiap hari. Sebuah centang tanpa commit hanya memberitahumu bahwa dulu, entah kapan,
sesuatu pernah bekerja — dan itu informasi yang nyaris tak berguna, tapi terasa seperti jaminan.
Itulah kenapa prosedurnya begini.

**Jangan mencentang kotak di `qa-manual-test.md` atau `qa-panduan-penguji.md`.** Kedua dokumen itu
**spesifikasi** — mereka menyatakan apa yang seharusnya benar, bukan apa yang kebetulan benar kemarin.
Hasil ditulis di sini, di file terpisah, satu file per sesi pengujian.

## Cara mencatat

1. Salin `_template.md` jadi `YYYY-MM-DD-<nama>.md`, misalnya `2026-07-14-arif.md`.
2. Isi kepalanya. Perintah ini memberimu isinya sekaligus:

   ```bash
   cd invois-macos
   echo "commit  : $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
   echo "kotor   : $(git status --porcelain | wc -l | tr -d ' ') file belum di-commit"
   echo "versi   : $(node -p "require('./package.json').version")"
   echo "macOS   : $(sw_vers -productVersion)"
   echo "tanggal : $(date '+%Y-%m-%d %H:%M')"
   ```

   Kalau **kotor** bukan nol, sebutkan itu apa adanya. Menguji pohon kerja yang belum di-commit itu
   sah — tapi hasilnya tidak bisa direproduksi siapa pun, termasuk dirimu besok. Catat, jangan
   sembunyikan.

3. Untuk tiap fase: **LOLOS**, **GAGAL**, atau **DILEWATI**. Tidak ada status keempat.

   "Dilewati" adalah jawaban yang jujur dan sering kali benar. Yang tidak boleh: mencentang LOLOS
   untuk sesuatu yang sebenarnya tidak kamu jalankan sampai tuntas.

4. Tiap **GAGAL** dapat satu blok temuan (lihat template). Tulis nomor fasenya, langkahnya, yang kamu
   lihat, yang kamu harapkan.

5. Commit catatannya. Ia jadi bagian dari sejarah repo — dan sejarah itulah yang menjawab "kapan
   terakhir kali migrasi vault benar-benar diuji tangan?"

## Kapan hasil lama jadi basi

Tidak ada aturan otomatis, dan aku tidak akan mengarangnya. Tapi pedoman yang jujur:

**Sebuah LOLOS gugur ketika kode yang mendasarinya berubah.** Kalau `data-store.ts` disentuh, semua
yang menyangkut vault (Fase 8, 9, 10) kembali jadi "belum diuji", tak peduli kemarin lolos. Kalau
`money.ts` atau `format.ts` disentuh, Fase 2 kembali kosong.

**Sebelum rilis, semuanya harus diuji ulang pada satu commit yang sama.** Sebelas fase yang lolos di
sebelas commit berbeda tidak membuktikan bahwa app-nya pernah utuh sekali pun.

## Yang TIDAK perlu dilaporkan lagi

Supaya penguji tidak membuang waktu, dan supaya laporan yang masuk benar-benar baru:

| Sudah diketahui | Keterangan |
|---|---|
| Kedipan hitam saat jendela dimaksimalkan | Celah native NSWindow. Diparkir. |
| Klik pada batang grafik dashboard tidak melakukan apa-apa | Fiturnya hilang saat Recharts dicopot. Menunggu keputusan: pasang lagi atau buang pipanya. |

Kalau daftar ini tumbuh, itu bukan pertanda baik. Daftar ini adalah utang, bukan pencapaian.

## Untuk penguji awam

Mereka memakai `qa-panduan-penguji.md` yang punya kotak isian sendiri. Mereka **tidak** menulis di
sini — mereka mengirimkan lembar isiannya ke Arif, dan Arif yang memindahkannya jadi satu file di
folder ini, dengan namanya dicantumkan.

Jangan pernah menerjemahkan laporan mereka jadi lebih rapi dari aslinya. Kalimat "kok angkanya jadi
aneh ya" adalah data. "Total tidak konsisten" adalah tafsirmu, dan tafsir bisa salah.
