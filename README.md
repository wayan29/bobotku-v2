# 🤖 Bobotku - Bot Telegram

## 📝 Deskripsi

Bobotku adalah bot Telegram yang menyediakan layanan transaksi digital terintegrasi. Bot ini mendukung pembelian produk digital melalui TokoVoucher dan Digiflazz, serta dilengkapi dengan fitur pengecekan tagihan PLN dan operator seluler.

## 🌟 Fitur Utama

- **🛍️ Transaksi Multi-Platform**
  - Integrasi dengan TokoVoucher
  - Integrasi dengan Digiflazz
  - Sistem signature yang aman
  - Tracking status transaksi

- **📱 Layanan Digital**
  - Pembelian pulsa dan paket data
  - Voucher game
  - Token PLN
  - Produk digital lainnya

- **🔍 Fitur Pengecekan**
  - Cek tagihan PLN
  - Deteksi operator seluler
  - Validasi nomor tujuan
  - Cek status transaksi

- **🛡️ Sistem Keamanan**
  - Validasi pengguna
  - Signature generation
  - Rate limiting
  - Error handling

## Struktur Proyek

Proyek ini telah direstrukturisasi untuk meningkatkan keterbacaan dan kemudahan pemeliharaan. Semua kode sumber aplikasi sekarang berada di dalam direktori `src`.

```
/
├── src/
│   ├── constants/
│   │   └── sceneKeys.js          # Konstanta untuk scene keys
│   ├── middleware/
│   │   ├── Checkop.js           # Middleware pengecekan operator
│   │   ├── CheckTOV.js          # Middleware TokoVoucher
│   │   └── Digiflazz.js         # Middleware Digiflazz
│   ├── models/
│   │   ├── mongoose.js          # Konfigurasi MongoDB
│   │   ├── tov.js              # Model TokoVoucher
│   │   └── trxdigi.js          # Model transaksi Digiflazz
│   ├── scenes/
│   │   ├── botMenu.js          # Scene menu utama
│   │   ├── enterDestinationNumber.js  # Input nomor tujuan
│   │   ├── enterServerId.js    # Input ID server
│   │   ├── productDetail.js    # Detail produk
│   │   ├── selectBrand.js      # Pemilihan brand
│   │   ├── selectCategory.js   # Pemilihan kategori
│   │   └── selectProduct.js    # Pemilihan produk
│   ├── services/
│   │   ├── chunck.js           # Utilitas chunking
│   │   ├── debug.js            # Utilitas debugging
│   │   ├── http_toko.js        # HTTP client TokoVoucher
│   │   ├── http.js             # HTTP client umum
│   │   ├── keyboard.js         # Layout keyboard Telegram
│   │   └── plncuy.js           # Layanan PLN
│   └── index.js                # Entry point aplikasi
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Instalasi

1.  **Clone repository ini:**
    ```bash
    git clone <URL_REPOSITORY>
    ```
2.  **Masuk ke direktori proyek:**
    ```bash
    cd bobotku
    ```
3.  **Install dependensi:**
    ```bash
    npm install
    ```

## ⚙️ Konfigurasi

1. **File .env**
   Buat file `.env` di root direktori dengan konfigurasi berikut:

   ```env
   # Bot Configuration
   TOKEN=your_telegram_bot_token

   # Database Configuration
   MONGO_URL=mongodb://username:password@localhost:27017/database

   # TokoVoucher Configuration
   member_code=your_member_code
   secret=your_secret_key
   signature=your_generated_signature     # Optional, will be auto-generated

   # Digiflazz Configuration
   username=your_digiflazz_username
   apikey=your_digiflazz_apikey
   ```

2. **Konfigurasi MongoDB**
   - Pastikan MongoDB terinstal dan berjalan
   - Buat database dan user sesuai konfigurasi
   - Atur akses dan privilese yang sesuai

## 🚀 Penggunaan

1. **Development Mode:**
   ```bash
   npm run dev      # Menjalankan dengan nodemon
   ```

2. **Production Mode:**
   ```bash
   npm start        # Menjalankan dalam mode produksi
   ```

3. **Debug Mode:**
   ```bash
   npm run debug    # Menjalankan dengan debug logging
   ```

## 🤝 Kontribusi

1. Fork repository ini
2. Buat branch fitur baru (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## Perintah Bot

-   `/start`: Memulai interaksi dengan bot.
-   `/pln [nomor_pelanggan]`: Memeriksa tagihan PLN.
-   `/checkop [nomor_telepon]`: Memeriksa operator seluler.
-   `/tovcheck [ref_id]`: Memeriksa status transaksi TokoVoucher.
-   `/tov`: Menampilkan semua transaksi TokoVoucher.
-   `/digicheck [ref_id]`: Memeriksa status transaksi Digiflazz.
-   `/digi`: Menampilkan semua transaksi Digiflazz.
# bobotku
