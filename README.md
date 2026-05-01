# WA Bot Camp WiFi

Bot WhatsApp untuk registrasi user dan pembagian voucher WiFi Camp. Bot membaca pesan registrasi dari WhatsApp, menyimpan data employee ke PostgreSQL, lalu membalas username dan password voucher yang masih tersedia.

## Fitur

- Login WhatsApp menggunakan QR Code.
- Session WhatsApp tersimpan otomatis dengan `LocalAuth`.
- Registrasi berdasarkan nomor WhatsApp.
- Badge dan nomor WhatsApp disimpan dalam bentuk hash HMAC SHA-256.
- Voucher yang sudah diberikan akan ditandai tidak tersedia.
- Mengabaikan pesan grup, status, broadcast, pesan kosong, dan pesan dari bot sendiri.

## Prasyarat

Pastikan sudah terpasang:

- Node.js 18 atau lebih baru.
- npm.
- PostgreSQL.
- Akun WhatsApp yang akan dipakai sebagai bot.

## Instalasi

Clone repository, lalu install dependency:

```bash
git clone <url-repository>
cd wa-bot-camp-wifi
npm install
```

## Konfigurasi Environment

Buat file `.env` di root project:

```env
DATABASE_NAME=nama_database
DATABASE_USER=username_database
DATABASE_PASSWORD=password_database
HASH_KEY=secret_hash_key_yang_panjang
```

Jika menggunakan dotenvx encrypted env, jalankan aplikasi dengan `DOTENV_PRIVATE_KEY`:

```bash
export DOTENV_PRIVATE_KEY="isi_private_key"
```

Atau sekali jalan:

```bash
DOTENV_PRIVATE_KEY="isi_private_key" npm start
```

## Enkripsi `.env` Dengan dotenvx

Project ini sudah menggunakan `@dotenvx/dotenvx`, jadi value di `.env` bisa dienkripsi sebelum project disimpan atau dibagikan.

Setelah `.env` berisi konfigurasi asli, jalankan:

```bash
npx dotenvx encrypt
```

Command tersebut akan mengubah value `.env` menjadi format terenkripsi dan menampilkan `DOTENV_PRIVATE_KEY`. Simpan `DOTENV_PRIVATE_KEY` di tempat aman, misalnya environment variable server, GitHub Actions secret, atau secret manager.

Untuk melihat keypair dotenvx:

```bash
npx dotenvx keypair
```

Untuk menjalankan aplikasi dengan `.env` terenkripsi:

```bash
DOTENV_PRIVATE_KEY="isi_private_key" npm start
```

Atau export dulu:

```bash
export DOTENV_PRIVATE_KEY="isi_private_key"
npm start
```

Jangan commit atau membagikan `DOTENV_PRIVATE_KEY`. Private key adalah kunci untuk membuka value `.env` yang terenkripsi.

## Setup Database

Buat database PostgreSQL sesuai `DATABASE_NAME`, lalu jalankan migration:

```bash
npx knex migrate:latest
```

Migration akan membuat tabel:

- `vouchers`
- `employee`
- `knex_migrations`

## Data Voucher

Isi tabel `vouchers` dengan data voucher yang tersedia. Contoh SQL:

```sql
INSERT INTO vouchers (id_login, password, available)
VALUES
  ('user001', 'pass001', true),
  ('user002', 'pass002', true);
```

Kolom penting:

- `id_login`: username WiFi.
- `password`: password WiFi.
- `available`: `true` jika voucher belum dipakai.

## Menjalankan Bot

Jalankan:

```bash
npm start
```

Jika berhasil, terminal akan menampilkan QR Code. Scan QR Code tersebut lewat WhatsApp:

1. Buka WhatsApp.
2. Masuk ke `Linked devices` atau `Perangkat tertaut`.
3. Pilih `Link a device`.
4. Scan QR Code di terminal.

Setelah login berhasil, terminal akan menampilkan:

```text
Client authenticated!
Client is ready!
```

## Format Pesan Registrasi

User mengirim pesan WhatsApp ke bot dengan format:

```text
badge: 12345
fullname: Nama Lengkap
department: IT
company: Nama Perusahaan
camp: Nama Camp
```

Jika format badge kosong atau bukan angka, bot akan membalas template:

```text
badge:
fullname:
department:
company:
camp:
```

## Alur Kerja Bot

1. Bot menerima pesan WhatsApp pribadi.
2. Bot hash nomor WhatsApp pengirim.
3. Bot cek apakah nomor tersebut sudah terdaftar di tabel `employee`.
4. Jika sudah terdaftar, bot membalas voucher yang sudah pernah diberikan.
5. Jika belum terdaftar, bot mencari voucher yang masih `available = true`.
6. Bot menyimpan data employee.
7. Bot mengubah voucher menjadi `available = false`.
8. Bot membalas username dan password WiFi.

## Troubleshooting

### Error `HASH_KEY belum diatur di environment`

Pastikan `.env` memiliki:

```env
HASH_KEY=secret_hash_key_yang_panjang
```

### Error `DATABASE_NAME masih terenkripsi`

File `.env` terenkripsi dotenvx, tetapi `DOTENV_PRIVATE_KEY` belum diatur. Jalankan:

```bash
export DOTENV_PRIVATE_KEY="isi_private_key"
npm start
```

### Error koneksi PostgreSQL

Pastikan:

- PostgreSQL sedang berjalan.
- Database sudah dibuat.
- `DATABASE_NAME`, `DATABASE_USER`, dan `DATABASE_PASSWORD` benar.
- User database punya akses ke database tersebut.

### QR Code tidak muncul

Coba hapus session WhatsApp lokal, lalu jalankan ulang:

```bash
rm -rf .wwebjs_auth .wwebjs_cache
npm start
```

### Bot tidak membalas pesan

Cek:

- Pesan dikirim ke chat pribadi bot, bukan grup.
- Format pesan sesuai template registrasi.
- Tabel `vouchers` masih punya data dengan `available = true`.
- Terminal tidak menampilkan error database.

## Catatan Keamanan

Jangan upload file berikut ke GitHub:

- `.env`
- `.wwebjs_auth`
- `.wwebjs_cache`
- `node_modules`

File-file tersebut sudah dimasukkan ke `.gitignore`.

## Command Ringkas

```bash
npm install
npx knex migrate:latest
npm start
```
