# Hak Pro: dari mana app tahu seseorang sudah membayar

Keputusan diambil 13 Juli 2026 (Arif). Dokumen ini mengikat: kalau kamu hendak menyimpang darinya,
ubah dokumennya dulu, jangan kodenya.

Belum ada billing sama sekali di kode. `isPro` di build produksi **selalu `false`** — `readDevPro`
menolak bekerja begitu `isDevBuild()` bernilai salah. Toggle Pro di Settings → Dev murni alat uji.
Jadi yang di bawah ini adalah rancangan untuk saat billing dipasang, bukan deskripsi keadaan sekarang.

---

## Aturannya

**App adalah Free sampai ada hak yang terbukti.** Tidak ada bukti, tidak ada Pro. Titik.

Yang dihitung sebagai bukti hanya dua:

1. Pembelian yang baru saja berhasil, atau
2. Hak yang dipulihkan dari akun Apple pengguna.

Yang **tidak** dihitung sebagai bukti: apa pun yang kita simpan sendiri di mesin pengguna.

## Kenapa

Pertanyaan yang melahirkan aturan ini: *"user pernah upgrade ke Pro, lalu uninstall, lalu install
lagi — Free atau Pro?"*

Kalau kita menyimpan status Pro sebagai boolean di localStorage, jawabannya kebetulan "Pro" — karena
menyeret aplikasi ke Trash **tidak** menghapus `~/Library/Application Support/Invois`. Tapi itu
kebetulan, bukan desain, dan ia pecah di tiga tempat sekaligus:

- Pindah ke Mac baru → hak itu hilang, padahal orangnya sama.
- Uninstall bersih → hak itu hilang.
- Siapa pun bisa mengarangnya dengan satu baris di DevTools.

Akarnya satu: **hak beli itu milik ORANG, bukan milik mesin, dan bukan milik folder.** Begitu kita
menyimpannya di tempat yang salah, semua gejala di atas mengikuti.

## Karena itu, dua larangan

**Jangan simpan hak Pro sebagai boolean lokal** (localStorage, file di userData, apa pun). Itu bukan
bukti; itu catatan yang bisa ditulis siapa saja.

**Jangan simpan hak Pro di dalam vault.** Vault dirancang untuk disalin, disinkron lewat iCloud, dan
dipindah antar-Mac. Kalau Pro tinggal di sana, menyalin vault ke teman sama dengan menyalin Pro.

## Pembuktian boleh otomatis

Aturannya berbunyi "sampai ada hak yang terbukti" — **bukan** "sampai user menekan tombol".
Bedanya penting.

Di Mac App Store, hak beli melekat pada Apple ID dan bisa ditanyakan StoreKit tanpa interaksi apa
pun. Jadi app **memeriksa diam-diam saat dibuka**. Pelanggan yang sudah membayar, install ulang di
Mac mana pun, membuka app, dan langsung Pro — tanpa berburu tombol.

Kalau kita membaca aturannya secara harfiah dan menuntut tombol ditekan, inilah yang terjadi:
seseorang yang sudah bayar membuka app, melihat dirinya Free, punya 300 invoice yang tak bisa
ditambah, dan harus menemukan "Restore Purchases" di Settings untuk memperbaikinya. Itu momen buruk
untuk orang yang justru sudah membayar, dan kita menciptakannya sendiri tanpa alasan.

Tombol **Restore Purchases** tetap ada — Apple mewajibkannya, dan ia jaring pengaman kalau
pemeriksaan otomatis gagal (offline, akun berganti).

**Di luar App Store** (distribusi mandiri), tidak ada Apple ID untuk ditanya. Di sana aturannya
berlaku harfiah: pengguna memasukkan ulang kunci lisensinya.

## Yang tidak boleh berubah

**Invoice lama tidak pernah disembunyikan atau dihapus.** `lib/limits.ts` sudah menjaminnya, dan
komentarnya sudah mengatakannya. Yang diblokir hanya **pembuatan** yang baru — membuka, menyunting,
mengekspor, dan menyimpan ulang invoice lama harus tetap bisa, selamanya, apa pun status haknya.

Ini yang membuat skenario terburuk tetap tidak menyandera siapa pun: seorang pelanggan Pro yang
sedang offline, atau yang pemeriksaan haknya gagal, tetap bisa membuka dan mengirim 300 invoice-nya.
Yang hilang cuma kemampuan menambah yang ke-301, dan itu pulih begitu haknya terbukti.

**Dialog upgrade wajib menawarkan jalan kedua.** Setiap kali ia muncul, harus ada "Sudah pernah beli?
Pulihkan pembelian". Tanpa itu, satu-satunya pintu yang kita sodorkan ke pelanggan lama adalah membayar
dua kali.

## Yang harus diubah di kode saat billing dipasang

**`isPro` sekarang dibaca SEKALI.** `lib/store.tsx`:

```ts
const [isPro] = React.useState(readDevPro);
```

Tidak ada setter, tidak ada langganan. StoreKit menjawab **asinkron**, jadi bentuk ini tidak bisa
menerima transisi "belum diperiksa → Pro". Ia harus jadi reaktif sebelum billing masuk — kalau tidak,
pemeriksaan otomatis akan berhasil dan UI tidak akan tahu.

**Penjaga `isDevBuild()` di `readDevPro` harus tetap ada.** Ia yang memastikan toggle Dev tidak pernah
bisa menyalakan Pro di build yang dikirim ke orang.

**`resolveTemplate` adalah penegakan yang sesungguhnya.** Gerbang di UI pemilih template hanya sopan
santun; yang benar-benar mencegah adalah `resolveTemplate(id, isPro)` di jalur render dan ekspor.
Jangan pernah menghapusnya dengan alasan "kan sudah dijaga di UI".

## Yang harus diuji nanti

- Beli → Pro seketika, tanpa restart.
- Uninstall → install ulang → **Pro otomatis**, tanpa menekan apa pun (App Store).
- Mac kedua, Apple ID sama → Pro.
- Offline saat dibuka → tetap Free, **tapi 300 invoice lama tetap bisa dibuka dan diekspor**; begitu
  online, Pro pulih sendiri.
- Apple ID berbeda → Free. (Dan tombol Restore tidak mengubahnya. Itu benar.)
- Vault Pro disalin ke Mac orang lain → **Free**. Kalau ternyata Pro, kita menaruh hak di tempat yang
  salah.
