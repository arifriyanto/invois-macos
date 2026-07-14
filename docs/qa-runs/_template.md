# Hasil uji — <tanggal> — <nama penguji>

| | |
|---|---|
| **Commit** | `<sha>` — <judul commit> |
| **Pohon kerja** | bersih / **kotor: <n> file** (sebutkan apa) |
| **Versi app** | <x.y.z> |
| **Build** | `npm run dev` / **terpaket** (`pack:mac`) |
| **macOS** | <versi> |
| **Vault yang dipakai** | <path> |
| **`npm run verify`** | LOLOS (<n> test) / GAGAL |

---

## Ringkasan

<Satu paragraf. Apa yang dijalankan, apa yang tidak, dan apa yang paling perlu diketahui orang yang
membaca ini enam minggu lagi.>

## Per fase

| Fase | | Status | Catatan |
|---|---|---|---|
| 0 | Persiapan | | |
| 1 | Pemasangan pertama (Free) | | |
| 2 | Uang & kuantitas | | |
| 3 | Simpan & batas Free | | |
| 4 | Ekspor | | |
| 5 | Settings | | |
| 6 | Banyak bisnis | | |
| 7 | Daftar & dashboard | | |
| 8 | Adopsi & penjaga sarang | | |
| 9 | Migrasi format vault | | |
| 10 | Kasus rusak | | |
| 11 | Jendela & menu | | |
| 12 | Build produksi | | |

Status: **LOLOS** / **GAGAL** / **DILEWATI**. Tidak ada yang lain. Kalau sebuah fase hanya dikerjakan
separuh, ia **DILEWATI**, bukan LOLOS — dan tulis separuh mana di kolom catatan.

---

## Temuan

### T-1 — <judul singkat>

- **Fase:** <mis. 2.3>
- **Langkah:** <sampai orang lain bisa mengulanginya persis>
- **Yang terjadi:** <apa adanya>
- **Yang diharapkan:** <menurut dokumen rencana>
- **Bukti:** <tangkapan layar / potongan `invois-data.json` / angka mentah>
- **Seberapa parah:** data hilang atau angka salah = **berhenti dan lapor sekarang**. Sisanya: catat
  dan lanjut.

<Salin blok ini untuk tiap temuan. Kalau tidak ada temuan, tulis "Tidak ada." — jangan hapus
bagiannya, supaya jelas bahwa memang dicari.>

---

## Yang TIDAK diuji, dan kenapa

<Jujur di sini. "Tidak sempat" adalah alasan yang sah dan berguna. Bagian yang diam-diam dilewati
tanpa dicatat adalah bagian yang akan menggigit saat rilis.>
