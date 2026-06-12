# WarungKu — Aplikasi Digitalisasi Warung Kelontong

Aplikasi web open-source untuk membantu UMKM (warung kelontong) mengelola bisnis mereka: sistem kasir (POS), manajemen stok, pencatatan hutang pelanggan, dan laporan penjualan. Gratis dan dirancang untuk satu perangkat per warung dengan antarmuka berbahasa Indonesia.

## ✨ Fitur

- **Sistem Kasir (POS)** — transaksi cepat dengan keranjang, pembayaran Tunai/Transfer/Hutang, hitung kembalian otomatis, dan struk yang bisa dicetak
- **Manajemen Produk** — CRUD produk lengkap, kategori, pencarian, filter, dan **import massal via CSV**
- **Manajemen Stok** — pemantauan stok, peringatan stok menipis, penyesuaian stok (tambah/kurang/set), dan riwayat pergerakan stok
- **Manajemen Pelanggan** — database pelanggan dengan riwayat transaksi dan ringkasan hutang
- **Hutang / Piutang** — pencatatan bon otomatis dari transaksi hutang, pembayaran cicilan, dan pelacakan status (Belum Bayar / Sebagian / Lunas)
- **Laporan Penjualan** — ringkasan omzet/profit/transaksi, grafik harian, dan **export CSV**
- **Laporan Produk Terlaris** — peringkat produk berdasarkan jumlah terjual atau omzet
- **Dashboard** — ringkasan bisnis real-time (omzet hari ini, transaksi, stok menipis, total piutang)
- **Autentikasi** — login aman berbasis JWT (httpOnly cookie) dengan peran Owner/Cashier

## 🛠️ Tech Stack

| Layer    | Teknologi                                              |
| -------- | ------------------------------------------------------ |
| Frontend | Next.js 16 (App Router), React 19, TailwindCSS v4, Recharts |
| Backend  | Node.js, Express 5, TypeScript                         |
| Database | PostgreSQL 16                                          |
| ORM      | Prisma 7 (driver adapter `@prisma/adapter-pg`)         |
| Auth     | JWT + bcrypt                                           |
| Testing  | Vitest                                                 |

Monorepo dikelola dengan npm workspaces: `apps/web` (frontend) dan `apps/api` (backend).

## 📋 Prasyarat

- Node.js 18+
- Docker & Docker Compose (untuk PostgreSQL)
- npm
- Untuk konsistensi laporan harian, disarankan menjalankan shell dengan `TZ=Asia/Jakarta` (lihat section [⏰ Timezone](#-timezone)). Container PostgreSQL di `docker-compose.yml` juga sudah di-set `TZ=Asia/Jakarta`.

## ⏰ Timezone

Semua tanggal pada laporan penjualan, dashboard, dan pengelompokan transaksi harian dihitung dalam **timezone Asia/Jakarta (WIB)**. Hal ini diterapkan di backend melalui `apps/api/src/utils/date.ts` (fungsi `localDateKey`), yang memformat `Date` berdasarkan komponen **waktu lokal server** — bukan UTC.

Di production (`docker-compose.prod.yml`), semua container sudah di-set `TZ=Asia/Jakarta` sehingga perilaku konsisten dengan kalender WIB.

Untuk **deployment development lokal** (di laptop developer), default `TZ` adalah timezone host, yang bisa saja berbeda dari WIB. Jika tidak disesuaikan, transaksi yang dibuat di sekitar tengah malam UTC bisa jatuh ke "hari" yang salah di laporan. Untuk menghindari hal ini, ada dua opsi:

**Opsi A — Set `TZ` di shell pengembangan** (lintas platform, paling sederhana):

```bash
export TZ=Asia/Jakarta
npm run dev
```

Atau inline:

```bash
TZ=Asia/Jakarta npm run dev
```

**Opsi B — Set `TZ` pada container PostgreSQL** di `docker-compose.yml` agar waktu server Postgres konsisten dengan WIB:

```yaml
services:
  postgres:
    environment:
      POSTGRES_USER: warung
      POSTGRES_PASSWORD: warung123
      POSTGRES_DB: warung_db
      TZ: Asia/Jakarta
```

Disarankan mengombinasikan keduanya (shell + container) supaya tidak ada mismatch antara waktu Node.js backend dan PostgreSQL.

> **Catatan multi-tenant trade-off:** saat ini sistem dirancang **single-tenant per deployment** (satu toko = satu instance). Karena logika "hari ini" mengikuti timezone server, multi-tenant dengan lokasi geografis berbeda dalam satu instance belum didukung dan akan membutuhkan refactor ke timezone per-tenant (penyimpanan `tz` di level user/store, dan penggunaan `Intl.DateTimeFormat`/library seperti `date-fns-tz`/`luxon` untuk konversi).

## ⚙️ Instalasi

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd aplikasi-warung
npm install
```

### 2. Konfigurasi environment

```bash
# Backend
cp apps/api/.env.example apps/api/.env

# Frontend
cp apps/web/.env.example apps/web/.env.local
```

Nilai default sudah sesuai untuk pengembangan lokal:

- `apps/api/.env` → `DATABASE_URL` menunjuk ke PostgreSQL Docker (port 5432), `JWT_SECRET`, `PORT=5000`
- `apps/web/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:5000/api`

### 3. Jalankan database & migrasi

```bash
npm run db:up        # Start PostgreSQL via Docker
npm run db:migrate   # Jalankan migrasi Prisma
npm run db:seed      # Isi data awal (opsional, sangat disarankan)
```

### 4. Jalankan aplikasi

```bash
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### 🔑 Kredensial default (dari seed)

```
Email    : owner@warung.test
Password : password123
```

Data seed juga membuat 5 kategori, 12 produk (2 di antaranya stok menipis untuk demo), dan 3 pelanggan.

## 📝 Skrip yang Tersedia

### Root

```bash
npm run dev          # Jalankan frontend & backend bersamaan
npm run dev:web      # Frontend saja
npm run dev:api      # Backend saja
npm run build        # Build production keduanya
npm run db:up        # Start database (Docker)
npm run db:down      # Stop database
npm run db:migrate   # Jalankan migrasi Prisma
npm run db:seed      # Isi data awal
npm run db:studio    # Buka Prisma Studio
```

### Backend (`apps/api`)

```bash
npm run test         # Jalankan unit test (Vitest)
npm run test:watch   # Test mode watch
npm run prisma:seed  # Seed database
```

## 🧪 Testing

Unit test untuk logika bisnis inti (penomoran transaksi, perhitungan kembalian, status hutang, penyesuaian stok, perhitungan profit) ada di `apps/api/tests/`. Fungsi murni diekstrak ke `apps/api/src/utils/calc.ts` agar mudah diuji tanpa database.

```bash
cd apps/api && npm run test
```

## 📁 Struktur Proyek

```
aplikasi-warung/
├── apps/
│   ├── api/                  # Backend Express + TypeScript
│   │   ├── prisma/           # Schema, migrasi, seed
│   │   ├── src/
│   │   │   ├── controllers/  # Logika endpoint
│   │   │   ├── routes/       # Definisi rute
│   │   │   ├── middleware/   # auth, error handling, upload
│   │   │   ├── schemas/      # Validasi Zod
│   │   │   ├── utils/        # calc (pure logic), serialize
│   │   │   └── index.ts      # Entry point
│   │   └── tests/            # Unit test Vitest
│   └── web/                  # Frontend Next.js
│       ├── app/              # App Router (login, protected pages)
│       ├── components/       # Komponen UI
│       ├── contexts/         # Auth & Toast context
│       └── lib/              # API client per domain
├── docker-compose.yml        # PostgreSQL (TZ=Asia/Jakarta)
└── package.json              # Workspace root
```

### ⚠️ Catatan Multi-Tenant

Repository ini adalah **single-tenant per deployment**: satu instance aplikasi = satu toko/warung. Semua data diasumsikan milik satu pemilik dengan satu timezone (WIB, lihat [⏰ Timezone](#-timezone)).

Trade-off yang harus disadari sebelum menjadikan ini multi-tenant:

- **Timezone per-tenant** — saat ini `localDateKey` menggunakan timezone server, sehingga beberapa tenant di zona berbeda akan melihat "hari ini" yang berbeda. Multi-tenant membutuhkan penyimpanan `tz` per store/user dan konversi tanggal sadar-timezone (mis. `date-fns-tz`, `luxon`).
- **Autentikasi & role** — skema `User` mendukung peran Owner/Cashier, tetapi belum ada model `Store`/`Tenant`. Penambahan tenant management akan menyentuh skema Prisma, middleware auth, dan hampir semua controller.
- **Laporan & dashboard** — agregasi harian (`groupBy hari`) saat ini dilakukan di level server; untuk multi-tenant, agregasi harus dipartisi per `tenantId`.
- **Deployment** — setiap tenant idealnya tetap di-deploy terpisah agar isolasi data lebih kuat, kecuali memang dibutuhkan shared instance (yang berarti refactor besar).

Untuk saat ini, jika Anda butuh beberapa warung sekaligus, pendekatan yang disarankan adalah **satu deployment per warung** (bisa di-host pada satu server dengan port berbeda).

## 🔌 Ringkasan API

Semua endpoint (kecuali login/register) memerlukan autentikasi via cookie `token` atau header `Authorization: Bearer <token>`. Format respons: `{ success, data?, message?, errors?, meta? }`.

| Method | Endpoint                          | Deskripsi                              |
| ------ | --------------------------------- | -------------------------------------- |
| POST   | `/api/auth/login`                 | Login                                  |
| POST   | `/api/auth/logout`                | Logout                                 |
| GET    | `/api/auth/me`                    | Info user saat ini                     |
| GET    | `/api/products`                   | List produk (pagination/search/filter) |
| POST   | `/api/products`                   | Buat produk                            |
| PUT    | `/api/products/:id`               | Ubah produk                            |
| DELETE | `/api/products/:id`               | Hapus / nonaktifkan produk             |
| GET    | `/api/products/:id/movements`     | Riwayat pergerakan stok                |
| POST   | `/api/products/:id/adjust-stock`  | Sesuaikan stok                         |
| GET    | `/api/products/import/template`   | Unduh template CSV                     |
| POST   | `/api/products/import`            | Import produk dari CSV                  |
| GET    | `/api/categories`                 | List kategori                          |
| GET    | `/api/customers`                  | List pelanggan                         |
| GET    | `/api/customers/:id`              | Detail pelanggan + hutang + transaksi  |
| POST   | `/api/customers`                  | Buat pelanggan                         |
| PUT    | `/api/customers/:id`              | Ubah pelanggan                         |
| DELETE | `/api/customers/:id`              | Hapus pelanggan (jika tidak ada hutang) |
| POST   | `/api/transactions`               | Buat transaksi (POS)                   |
| GET    | `/api/transactions`               | List transaksi                         |
| GET    | `/api/transactions/:id`           | Detail transaksi                       |
| GET    | `/api/debts`                      | List hutang (filter status/pelanggan)  |
| GET    | `/api/debts/:id`                  | Detail hutang + riwayat pembayaran     |
| POST   | `/api/debts/:id/payment`          | Catat pembayaran cicilan               |
| GET    | `/api/reports/sales`              | Laporan penjualan                      |
| GET    | `/api/reports/sales/export`       | Export laporan penjualan (CSV)         |
| GET    | `/api/reports/top-products`       | Produk terlaris                        |
| GET    | `/api/dashboard/stats`            | Statistik dashboard                    |

## 🚀 Deployment Produksi (Docker)

Seluruh stack (PostgreSQL + API + Web) dapat dijalankan dengan Docker Compose.

### 1. Siapkan environment

```bash
cp .env.prod.example .env
```

Edit `.env` dan **wajib** ganti:

- `POSTGRES_PASSWORD` — password database yang kuat
- `JWT_SECRET` — string acak panjang, mis. hasil `openssl rand -hex 32`
- `NEXT_PUBLIC_API_URL` — URL API yang diakses dari browser. Untuk akses dari perangkat lain di jaringan, gunakan IP/domain server (mis. `http://192.168.1.10:5000/api`), bukan `localhost`.
- `WEB_ORIGIN` — URL frontend (untuk CORS).

### 2. Build & jalankan

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Web: http://localhost:3000
- API: http://localhost:5000

Migrasi database (`prisma migrate deploy`) dijalankan otomatis saat container API start.

### 3. Buat data awal / akun admin

Container API tidak otomatis melakukan seed. Jalankan seed sekali untuk membuat akun owner default (dan data contoh):

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

Akun default: `owner@warung.test` / `password123` — **segera ganti password** untuk produksi.

### Catatan

- **Timezone**: semua container di-set `TZ=Asia/Jakarta` agar perhitungan "hari ini" pada dashboard dan pengelompokan harian pada laporan sesuai kalender WIB.
- `NEXT_PUBLIC_API_URL` di-_inline_ saat build image web. Jika URL berubah, rebuild image web (`--build`).
- Data PostgreSQL disimpan di volume `postgres_prod_data` agar persisten antar restart.

## 🤝 Contributing

Kontribusi sangat diterima! Silakan buat issue atau pull request.

## 📄 License

MIT License — gratis dan open source untuk membantu UMKM Indonesia.
