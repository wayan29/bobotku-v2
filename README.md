# 🤖 Bobotku — Telegram Bot Transaksi Digital

Bot Telegram untuk pembelian produk digital lintas provider (TokoVoucher & Digiflazz) dengan alur yang rapi dan ramah perangkat mobile. Mendukung konfirmasi pesanan dan PIN transaksi yang tersembunyi (masked) via keypad inline, serta pencatatan transaksi ke MongoDB.

## 🌟 Fitur Utama

- 🧩 Multi-Provider: TokoVoucher & Digiflazz
- 🧭 Alur tertata: Kategori → Brand → Produk → Detail → Konfirmasi → PIN
- 🔒 PIN transaksi aman: keypad inline, tidak tampil di chat (masked)
- 🧾 Log transaksi ke MongoDB (riwayat, status, harga, SN, dsb.)
- 🔎 Utilitas: cek PLN (`/pln`), cek operator (`/op`), cek status transaksi
- 📱 Tampilan mobile-friendly: daftar dipecah per blok, penomoran 2 digit

## 🧱 Arsitektur Singkat

- Telegraf Scenes (FSM):
  - `selectCategory` → `selectBrand` → `selectProduct` → `productDetail` → `enterDestinationNumber` → `enterServerId`
  - Provider handler: `scenes/providers/digiflazz.js`, `scenes/providers/tokovoucher.js`
- Middleware:
  - `middleware/CheckTOV.js`, `middleware/Digiflazz.js`, `middleware/Checkop.js`
- Model MongoDB:
  - `models/mongoose.js` (User premium gate), `models/trxdigi.js`, `models/tov.js`, `models/transactionLog.js`
- Layanan/Util:
  - `services/http.js` (Digiflazz), `services/http_toko.js` (TokoVoucher)
  - `services/keyboard.js` (keyboard/chunking), `services/pinpad.js` (keypad PIN masked), `services/plncuy.js`

## 📦 Struktur Proyek

```
/
├── src/
│   ├── constants/
│   │   └── sceneKeys.js
│   ├── middleware/
│   │   ├── Checkop.js
│   │   ├── CheckTOV.js
│   │   └── Digiflazz.js
│   ├── models/
│   │   ├── mongoose.js
│   │   ├── tov.js
│   │   ├── trxdigi.js
│   │   └── transactionLog.js
│   ├── scenes/
│   │   ├── botMenu.js
│   │   ├── enterDestinationNumber.js
│   │   ├── enterServerId.js
│   │   ├── productDetail.js
│   │   ├── providers/
│   │   │   ├── digiflazz.js
│   │   │   └── tokovoucher.js
│   │   ├── selectBrand.js
│   │   ├── selectCategory.js
│   │   └── selectProduct.js
│   ├── services/
│   │   ├── http.js
│   │   ├── http_toko.js
│   │   ├── keyboard.js
│   │   ├── pinpad.js
│   │   └── plncuy.js
│   └── index.js
├── data/white_id.json
├── .env
├── package.json
└── README.md
```

## ⚙️ Konfigurasi

Buat `.env` di root (variabel yang relevan):

```env
# Telegram Bot
TOKEN=your_telegram_bot_token

# MongoDB
MONGO_URL=mongodb://username:password@host:27017/dbname

# Digiflazz
username=your_digiflazz_username
apikey=your_digiflazz_apikey

# TokoVoucher
member_code=your_member_code
secret=your_secret_key
signature=your_signature   # opsional bila layanan Anda membutuhkannya

# Keamanan Transaksi
PIN_TRANSAKSI=123456       # PIN yang wajib dimasukkan sebelum transaksi
PIN_MAXLEN=6               # opsional (default 6)

# Production webhook (opsional)
HEROKU_URL=https://yourapp.example.com
PORT=3000
NODE_ENV=production
```

Catatan akses pengguna:
- Bot hanya melayani user dengan `isPremium=true`. Pertama kali user kirim pesan, datanya tersimpan ke koleksi `white_id`.
- Set premium via MongoDB, contoh:
  - `db.white_id.updateOne({ chatId: "<CHAT_ID>" }, { $set: { isPremium: true }})`

## 🚀 Menjalankan

- Development (polling):
  ```bash
  npm install
  npm run dev
  ```
- Production:
  ```bash
  npm install --production
  npm start
  ```

## 🧭 Alur Penggunaan (UX)

1) Pilih Provider (TokoVoucher / Digiflazz)
2) Pilih Kategori → Brand → Produk
3) Tinjau Detail → Masukkan nomor tujuan (dan Server ID bila perlu)
4) Konfirmasi pesanan (Setuju/Batal)
5) Masukkan PIN via keypad inline (tertutup/masked)
6) Transaksi diproses → hasil ditampilkan → log tersimpan

> ℹ️ Catatan: Integrasi /ai (rekomendasi otomatis) sudah dinonaktifkan. Semua alur kembali sepenuhnya manual melalui menu provider.

## 🔐 Tentang PIN Tertutup

- PIN tidak pernah tampil sebagai teks chat; input via tombol inline 0–9.
- Tersimpan sementara di `session` hingga transaksi selesai/batal.
- Batas panjang dikontrol `PIN_MAXLEN` (default 6). Jika sudah maksimum, keypad tidak mengubah pesan (hindari error 400), dan bot menampilkan notifikasi kecil.

## 🧰 Perintah Bot

- `/start` — mulai interaksi
- `/pln <no_pelanggan>` — validasi/cek PLN
- `/op <nomor_hp>` — deteksi operator seluler
- `/tov <ref_id>` — cek status transaksi TokoVoucher (alias lama: `/tovcheck`)
- `/tov` — daftar transaksi TokoVoucher
- `/dg <ref_id>` — cek status transaksi Digiflazz (alias: `/digicheck`)
- `/dg` — daftar transaksi Digiflazz (alias: `/digi`)
- `/transactions` — 10 log transaksi terakhir (gabungan)

## 🐞 Troubleshooting

- 400 message is not modified pada keypad PIN: sudah ditangani. Pastikan `PIN_MAXLEN` sesuai panjang PIN.
- Tidak bisa akses bot: set `isPremium=true` untuk chatId Anda di DB.
- Data Digiflazz kosong: sistem akan force refresh saat membuka kategori Digiflazz; cek kredensial `.env` bila tetap kosong.

## 🤝 Kontribusi

1) Fork repo ini
2) Buat branch fitur (`feat/...`)
3) Commit singkat dan jelas
4) PR dengan deskripsi perubahan

---

Selamat bertransaksi dengan aman dan nyaman! 🎉
