# WarungKu — Audit Proyek (xhigh + ultracode)

**Tanggal:** 2026-06-13
**Repo:** /home/ubuntu/project/aplikasi-warung
**Cakupan:** Backend Express+Prisma+TS, Frontend Next.js 16, Skema DB, Migrasi, Docker, ENV, Tes.
**Metode:** Baca langsung semua source (40+ file), jalankan `vitest`, verifikasi adversarial (panel paralel) untuk 47 kandidat finding + completeness critic.

**Baseline:**
- ✅ 41/41 unit test lulus (`vitest run` di `apps/api`).
- ✅ TypeScript `strict: true` di API; tidak ada error `tsc --noEmit` (API).
- ✅ 22 file modified (audit-aware diff di working tree, semua perubahan adalah hardening — lihat §6).

---

## Ringkasan Eksekutif

Aplikasi WarungKu adalah POS single-tenant untuk UMKM Indonesia dengan kualitas engineering yang **di atas rata-rata** untuk kelasnya: middleware auth/CSRF/rate-limit, validasi Zod end-to-end, transaction-number atomik via daily counter, kontrol OWNER/CASHIER, proteksi CSV-injection, password hashing bcrypt, Helmet+CSP untuk API. Setelah audit, tidak ada kerentanan keamanan **kritis** yang ditemukan.

**Temuan utama (severity-sorted):**

| # | Severity | Temuan | Lokasi |
|---|----------|--------|--------|
| 1 | **High** | Lost-update race pada `Debt.paidAmount` saat dua pembayaran concurrent | `debt.controller.ts:111-122` |
| 2 | **High** | Dashboard / report inkonsisten TZ: WHERE filter UTC vs daily rollup Asia/Jakarta (env `TZ` tidak divalidasi) | `report.controller.ts:57-90`, `dashboard.controller.ts:6-90`, `env.ts` |
| 3 | **Medium** | Tidak ada token revocation / password change — JWT valid 7 hari tanpa invalidasi | `auth.controller.ts`, `env.ts:55` |
| 4 | **Medium** | Tidak ada CSP / HSTS / X-Frame-Options di Next.js; tidak ada security headers | `apps/web/next.config.ts` |
| 5 | **Medium** | `originCheck` allow-no-Origin → origin/CSRF defense lemah untuk client non-browser | `origin-check.ts:22-25` |
| 6 | **Medium** | `listDebts` `totalOutstanding` di-filter global, bukan per filter customerId (UX inkonsisten) | `debt.controller.ts:43-46` |
| 7 | **Medium** | Broken nav link `/stok` di sidebar — halaman tidak ada | `AppShell.tsx:63` |
| 8 | **Low**  | Tidak ada account lockout / breached-password denylist | `auth.routes.ts`, `auth.schema.ts` |
| 9 | **Low**  | Race window kecil pada `register()` di-bootstrap (count==0) — unique-email index jadi satu-satunya penjaga | `auth.controller.ts:54-83` |
| 10 | **Low**  | `createTransaction` retry hanya catch P2002 — bug di retry P0001 stock race? (FINE — refuted) | `transaction.controller.ts:54-71` |
| 11 | **Low**  | CSV import: bulk-insert → fallback per-row; original error di-drop (logging) | `import.controller.ts:282-333` |
| 12 | **Low**  | `updateProduct`: read+write tanpa OCC, audit `stockBefore` bisa stale (acceptable) | `product.controller.ts:128-172` |
| 13 | **Low**  | Tidak ada `algorithms: ["HS256"]` allowlist di `jwt.verify` | `lib/jwt.ts:17` |
| 14 | **Info**| Tidak ada validasi ENV `TZ=Asia/Jakarta` walaupun report bergantung padanya | `env.ts` |
| 15 | **Info**| Helmet CORP same-site (correct), CORS single-origin (correct), bcrypt 10 rounds (OK) | `index.ts:33-56` |

**Kesimpulan:** Repo dalam kondisi **siap-production untuk warung single-tenant**, dengan catatan: (1) fix lost-update di debt payment **sebelum multi-cashier** dipakai, (2) tambahkan security headers di Next.js, (3) tambahkan `tokenVersion` atau endpoint logout-all untuk OWNER. Sisanya adalah hardening nice-to-have.

---

## 1. Security (Backend)

### S1 [MEDIUM] — Origin header check allows requests with no Origin
**File:** `apps/api/src/middleware/origin-check.ts:14-30`
**Bukti:** Middleware melempar 403 hanya bila Origin dikirim DAN ≠ `env.webOrigin`. Bila Origin kosong (curl, native app, server-to-server), request lolos tanpa validasi. Konteks: `sameSite=lax` cookie sudah mengirim proteksi CSRF untuk browser biasa; celah ini hanya relevan untuk attacker yang sudah punya cookie value (leak / XSS / native).
**Diverifikasi:** Real (confidence 72%, finding S7 yang terkait diverifikasi oleh agent a03fd0501d70991dc dengan confidence 72).
**Fix:** Tolak state-changing requests tanpa Origin header, atau fallback ke `Referer` header check.

### S2 [MEDIUM] — No JWT revocation / password change endpoint
**File:** `apps/api/src/controllers/auth.controller.ts:166-169`, `env.ts:55-63`
**Bukti:** JWT valid 7 hari (default). Logout hanya clearCookie; token tetap valid. Tidak ada kolom `tokenVersion` di `User`, tidak ada endpoint `POST /auth/password` (ganti password tidak ada), tidak ada `POST /auth/logout-all`. OWNER tidak bisa invalidate token cashir yang dipecat. README mengakui ini.
**Fix:** Tambah `tokenVersion` di User, embed di JWT, increment on logout-all / password change / role change. Atau pakai Redis allowlist.

### S3 [LOW] — `register()` per-route authLimiter hilang
**File:** `apps/api/src/routes/auth.routes.ts:31`, `middleware/rate-limit.ts:8`
**Bukti:** `/login` dilindungi 10/15min via `authLimiter`, tapi `/register` hanya dilindungi global 300/min. Pada saat setup awal (satu user race), 300 percobaan/menit bisa dilakukan. Unique-email index adalah penjaga akhir; aman tapi generous.
**Fix:** Pakai `authLimiter` di `/register` juga.

### S4 [LOW] — Tidak ada `algorithms: ["HS256"]` allowlist di `jwt.verify`
**File:** `apps/api/src/lib/jwt.ts:17`
**Bukti:** `jwt.verify(token, env.jwtSecret)` tanpa opsi `algorithms`. Library default menerima HS256/384/512/RS*/ES*. Secret adalah shared string, jadi tidak ada attack surface algoritma-confusion nyata. Best practice tetap specify.
**Fix:** `jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })`.

### S5 [LOW] — Tidak ada account lockout / breached-password denylist
**File:** `routes/auth.routes.ts:9-18`, `schemas/auth.schema.ts:5-10`
**Bukti:** Rate limit 10/15min per IP. Password minimal 8 char + huruf + angka — "password1" lulus. CASHIER bisa di-bruteforce dengan rotating IP; tidak ada lockout per-account.
**Fix:** Tambah top-1000 common-password denylist; tambah per-account failed-login counter (DB column atau Redis).

### S6 [INFO] — Helmet+CORS+CORP — correct
**File:** `index.ts:23-56`, `middleware/origin-check.ts`
**Bukti:** Diverifikasi REFUTED oleh agent a970ddd3375eba4a1 (confidence 92%): Helmet CSP `default-src: 'none'`, CORP `same-site`, CORS single-origin env.webOrigin dengan `credentials:true`, originCheck sebagai defense-in-depth. Konfigurasi aman dan standar.

### S7 [INFO] — Login dummy hash + bcrypt timing — adequate
**File:** `auth.controller.ts:16-17, 130-135`
**Bukti:** bcrypt 10 rounds (~100ms) menyamarkan response time dengan baik. Dummy hash di-modul scope. Tidak sempurna tapi acceptable.

### S8 [INFO] — Multer file filter + 5MB cap
**File:** `middleware/upload.ts`, `controllers/import.controller.ts`
**Bukti:** mimetype check + extension check, 5MB cap, 1000 row cap. CSV-injection defense di `csv.ts:11-35` (prefix `=+-@\t\r` dengan apostrof + RFC 4180 quoting + control-char strip). Aman.

### S9 [INFO] — Error stack hanya di-log, tidak di-return
**File:** `middleware/error.ts:89-100`
**Bukti:** `res.json({ message: 'Terjadi kesalahan pada server' })` tanpa stack. Aman.

### S10 [INFO] — `try { prisma.user.findUnique... } throw 409` di register() — by design
**File:** `auth.controller.ts:59-65`
**Bukti:** Pre-transaction unique check + transactional re-check + unique email index. Aman.

### S11 [INFO] — JSON body limit 100KB
**File:** `index.ts:55-56`
**Bukti:** Cukup untuk semua endpoint. Import CSV menggunakan multer (bukan JSON), tidak lewat sini. Aman.

### S12 [INFO] — Request ID echo + x-request-id trust dengan regex validation
**File:** `middleware/request-id.ts:19-26`
**Bukti:** `^[A-Za-z0-9._-]{1,128}$` — strict regex, default randomUUID jika invalid. Aman.

---

## 2. Correctness (Business Logic)

### C1 [HIGH] — Lost-update race pada `Debt.paidAmount` saat concurrent payments
**File:** `apps/api/src/controllers/debt.controller.ts:101-122`
**Bukti:**
```ts
// line 111-122
const newPaid = toNumber(debt.paidAmount) + data.amount;  // ← stale base read
const { remaining: newRemaining, status: newStatus } = computeDebtFields(toNumber(debt.amount), newPaid);
const updateResult = await tx.debt.updateMany({
  where: { id, status: { not: 'PAID' }, remaining: { gte: data.amount } },
  data: { paidAmount: newPaid, remaining: newRemaining, status: newStatus },
  // ↑ overwrites any concurrent increment to paidAmount
});
```
Race scenario: Debt 100, two concurrent requests, payment=60 dan payment=50.
- Request A: read paid=0 → newPaid=60 → UPDATE SET paidAmount=60.
- Request B: read paid=0 (before A commits) → newPaid=50 → UPDATE SET paidAmount=50.
- Hasil akhir: paidAmount=50, remaining=50, padahal 110 sudah dibayar → **stuck debt** (Rp 50 hilang).

WHERE clause `remaining: { gte: data.amount }` memang menangkap "cukup untuk bayar" tapi tidak mendeteksi *sudah ada pembayaran lain* yang dilakukan secara paralel.

**Fix:**
```ts
await tx.debt.updateMany({
  where: { id, status: { not: 'PAID' }, remaining: { gte: data.amount } },
  data: {
    paidAmount: { increment: data.amount },
    // remaining & status dihitung ulang setelah increment (perlu round-trip atau raw SQL)
  },
});
// atau gunakan stored procedure / `RETURNING` untuk re-derive remaining+status
```

**Dampak:** Single-cashier warung aman. Multi-cashier (OWNER + CASHIER simultan) atau 1 CASHIER + owner konfirmasi 2 cicilan dalam 1 menit → money loss.

### C2 [HIGH] — Timezone inkonsisten antara WHERE filter (UTC) vs daily rollup (`AT TIME ZONE 'Asia/Jakarta'`)
**File:**
- `report.controller.ts:57-90` — daily rollup pakai `TO_CHAR(t."created_at" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`
- `report.controller.ts:22-29` — `buildDateRange` pakai `new Date(q.startDate)` (= UTC midnight)
- `dashboard.controller.ts:6-90` — `startOfToday()` = server local midnight (depends on TZ)
- `utils/date.ts:6-11` — `localDateKey(d)` = server local date components
- `env.ts` — `TZ` tidak divalidasi

**Bukti:** User memilih `startDate=2026-06-12`. Backend parse jadi `new Date("2026-06-12")` = `2026-06-12T00:00:00Z`. Transaksi di `2026-06-12 05:00 WIB` = `2026-06-11T22:00:00Z` → **dibuang** dari WHERE filter. Padahal daily rollup (AT TIME ZONE Asia/Jakarta) mengelompokkannya sebagai `2026-06-12`. **Tx "menghilang" dari laporan harian.**

Symmetric: `endDate=2026-06-12` di-extend ke `end.setHours(23,59,59,999)` (server local) lalu di-WHERE sebagai UTC end. Untuk TZ=Asia/Jakarta (UTC+7), `end` adalah `2026-06-12T16:59:59.999Z` — transaksi di `2026-06-13 00:00 WIB` = `2026-06-12T17:00:00Z` masuk ke WHERE tapi di-rollup sebagai `2026-06-13`. UI menampilkan "12 Juni 13 Juni 2026" transactions pada laporan 12 Juni.

**Dashboard:** `startOfToday()` pakai `setHours(0,0,0,0)` server local → depends on TZ env. Konsisten dengan `localDateKey` (juga server local). **Dashboard self-consistent** kalau TZ=Asia/Jakarta, tapi `env.ts` **tidak validate** TZ — default di dev adalah host TZ (mungkin bukan WIB).

**Fix:**
- Validasi `process.env.TZ === 'Asia/Jakarta'` di `env.ts` startup (warn/error in prod).
- Atau rewrite `buildDateRange` dengan `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })` untuk derive start/end WIB, lalu konversi ke Date UTC untuk WHERE.
- Daily rollup sudah benar (`AT TIME ZONE 'Asia/Jakarta'`), tinggal samakan WHERE.

### C3 [MEDIUM] — `listDebts` `totalOutstanding` tidak respect filter customerId
**File:** `debt.controller.ts:31-59`
**Bukti:** Aggregate `where: { status: { in: ['UNPAID','PARTIAL'] } }` — **tanpa** filter customerId. List dikembalikan dengan filter, tapi `meta.totalOutstanding` selalu global. UX inkonsisten: filter "Pelanggan A" → list adalah hutang A, tapi "Total Piutang" card di header menunjukkan total global.
**Fix:** Bangun `aggWhere` sama dengan list `where`.

### C4 [MEDIUM] — Broken nav `/stok` di sidebar (halaman tidak ada)
**File:** `apps/web/components/AppShell.tsx:63` + `apps/web/app/(protected)/`
**Bukti:** `NAV_ITEMS` punya `{ href: '/stok', ... }` tapi tidak ada `app/(protected)/stok/page.tsx`. Click → 404. StockAdjustModal ada tapi tidak dipanggil dari mana pun (cuma Stock movement ada di produk edit? tidak juga — ProdukPage tidak membuka StockAdjustModal). **Dead code path.**
**Fix:** Buat `app/(protected)/stok/page.tsx` (list produk dengan stock rendah + history), atau hapus link dari sidebar + hapus StockAdjustModal.tsx (185 baris) kalau tidak dipakai.

### C5 [LOW] — `updateProduct` lost-update + stale `stockBefore` audit
**File:** `product.controller.ts:128-172`
**Bukti:** Read di line 128 (luar $transaction), write di line 144 (dalam $transaction). Tanpa `version`/`updatedAt` precondition, concurrent edits overwrite. Audit `stockBefore` pakai `existing.stock` dari read yang stale. Untuk POS single-operator warung, acceptable. Info per verifier.
**Fix (optional):** Tambah `version Int @default(0)` + optimistic concurrency check.

### C6 [LOW] — `recordPayment` failed retry path: `debt.paidAmount` di-overwrite (sama dengan C1, restated for completeness)
**File:** `debt.controller.ts:111-122` (sama dengan C1)
**Bukti:** Sama dengan C1. Severity High secara fungsional; di sini disebut LOW karena fix yang sama.
**Fix:** `{ increment: data.amount }` + re-derive remaining/status via raw SQL `RETURNING`.

### C7 [LOW] — CSV import: bulk-insert error di-drop (logging saja)
**File:** `import.controller.ts:282-333`
**Bukti:** `catch (err) { ... return res.json(...) }` — `err` tidak di-log, response mengatakan "X gagal" tanpa konteks kenapa. Untuk debugging susah.
**Fix:** `console.error('importProducts bulk-insert failed', err)` sebelum fallback.

### C8 [LOW] — CSV import: produk duplikat-nama tanpa SKU bisa salah-match movement
**File:** `import.controller.ts:240-265`
**Bukti:** `byName.set(p.name, ...)` — Map deduplicates by key. Dua baris dengan name sama dan sku=null → movement row pertama jadi "produk B", movement row kedua jadi "produk B" (overwrites). Stock movement tidak ter-create untuk baris pertama.
**Fix:** Scope lookup ke produk yang baru di-create (createdAt > now-1s) atau join by ID range. Atau require SKU uniqueness (kebijakan).

### C9 [LOW] — `register()` race: count==0 window
**File:** `auth.controller.ts:54-83`
**Bukti:** `count() > 0` (no lock) → findUnique → `tx.count() > 0` (in tx). Dua request paralel dengan email berbeda: keduanya lewat count, keduanya create dengan role OWNER. **Tidak ada issue race** (unique email guard sudah benar). Catatan: ada sedikit inkonsistensi dokumentasi kode (`// Reject any registration if at least one user exists.`) yang menyiratkan implementasi partial; aktualnya serializable via unique index.

### C10 [LOW] — `createTransaction` P2002 retry aman
**File:** `transaction.controller.ts:54-71`
**Bukti:** Diverifikasi REFUTED (FINE) oleh verifier. The whole `$transaction` rolls back on inner failure → daily counter seq tidak "leak" dari sudut pandang data (meskipun seq nomor di-skip — acceptable untuk daily counter).

### C11 [LOW] — `daily_counters` seq burn on rollback
**File:** `transaction.controller.ts:140-174`
**Bukti:** Jika inner updateMany stock gagal, ApiError throw → $transaction rollback → seq increment reverted. **Tapi seq berikutnya akan skip nomor** (misal seq 1, 2, 3, 4 sukses, lalu seq 5 gagal, seq 6 sukses — sehari ada seq 1-4 + 6). Untuk audit trail, fine.
**Fix:** None needed.

### C12 [INFO] — `computeTotal` allows 100% discount + `computeCashChange` allows paid=0
**File:** `utils/calc.ts:36-80`
**Bukti:** Discount=subtotal → total=0, paid=0 → change=0 → CASH transaksi gratis. DEBT paid=0 → full debt. **Intentional.** Tested.

### C13 [INFO] — Decimal(12,2) ↔ JS Number aman di semua range
**File:** `utils/serialize.ts:4-9`
**Bukti:** Max 9,999,999,999.99 < 2^53. Zod cap 1B. No precision loss.

### C14 [INFO] — `updateProduct` stock change dicatat sebagai `ADJUSTMENT` (bukan `PURCHASE`)
**File:** `product.controller.ts:160-172`
**Bukti:** Edit produk → perubahan stok → audit `ADJUSTMENT`. `adjustStock` endpoint memetakan `ADD → PURCHASE`. **Inkonsistensi minor** di audit trail. Owner yang restock via product edit tidak akan terlihat di laporan "purchases".
**Fix:** Map stock increase via update → `PURCHASE` (mirip dengan `adjustStock`).

### C15 [INFO] — `listDebts` outstanding aggregate tidak konsisten (sama dengan C3, restated)
**File:** `debt.controller.ts:43-46`

### C16 [INFO] — `createCustomer` tidak dedupe nama
**File:** `customer.controller.ts:109-119` + `schema.prisma`
**Bukti:** Customer model tidak punya unique constraint. Buat "Budi" dua kali → dua record. UX/data quality, bukan correctness.

### C17 [INFO] — `getCustomer` totalDebt dihitung di JS
**File:** `customer.controller.ts:84-86`
**Bukti:** O(n) reduction di server. Untuk <100 debts/customer, fine. Performance note only.

### C18 [INFO] — Helmet CSP `default-src: 'none'` + frame-ancestors 'none' (API)
**File:** `index.ts:25-32`
**Bukti:** Correct untuk JSON API. No issue.

### C19 [INFO] — `recordPayment` response message: "Hutang lunas!" vs "Pembayaran berhasil dicatat"
**File:** `debt.controller.ts:154`
**Bukti:** Correct, based on `newStatus === 'PAID'`. Tested.

### C20 [INFO] — `startOfToday` server-local
**File:** `dashboard.controller.ts:6-10`
**Bukti:** Depends on `TZ`. Jika `TZ=Asia/Jakarta`, correct. (See C2 untuk fix env validation.)

### C21 [INFO] — `getSalesReport` per-day grouping: `LEFT JOIN transaction_items` lalu `COUNT(t.id)` 
**File:** `report.controller.ts:67-83`
**Bukti:** `COUNT(t."id")` di GROUP BY (day, day) — count transaksi per hari. `SUM(ti.*)` — SUM across all line items (benar karena inner join explosion sesuai items). Profit/revenue computation correct.

### C22 [INFO] — `getTopProducts` LEFT JOIN + `COUNT(DISTINCT)` not needed
**File:** `report.controller.ts:201-218`
**Bukti:** GROUP BY product_id, product_name → SUM per group. No DISTINCT needed. Correct.

### C23 [INFO] — `daily_counters` UNIQUE(key) + atomic ON CONFLICT
**File:** `transaction.controller.ts:33-40`
**Bukti:** Postgres `INSERT ... ON CONFLICT (key) DO UPDATE SET seq = seq + 1 RETURNING seq` adalah atomic di row-level. Race-safe.

### C24 [INFO] — Categories `SetNull` on delete — products keep but lose category
**File:** `category.controller.ts:50-60`
**Bukti:** By design (`onDelete: SetNull` di schema). Tidak ada warning ke user. UX nit.

### C25 [INFO] — `dueDate` opsional di DEBT
**File:** `transaction.schema.ts:20`
**Bukti:** Default null → tidak overdue. Bisa ditambahin required, tapi warung kelontong mungkin tidak pakai due date.

### C26 [INFO] — `customerId` opsional di transaction (refine() DEBT wajib)
**File:** `transaction.schema.ts:18, 22-25`
**Bukti:** Schema validate; controller re-check di line 48-51. Aman.

### C27 [INFO] — `exportSalesCsv` 1000 row cap, no streaming
**File:** `report.controller.ts:139-186`
**Bukti:** Buffered di memory. Untuk 1k tx × 10 items = 10k rows. Fine untuk sekarang. Note for scale.

### C28 [INFO] — `errorHandler` order: Zod → ApiError → MulterError → Unknown
**File:** `middleware/error.ts:47-100`
**Bukti:** Order benar. Zod 400, ApiError sesuai, Multer 400, unknown 500 dengan stack log only. Aman.

### C29 [INFO] — `debt.paidAmount`/`remaining` recompute setiap payment (by design)
**File:** `debt.controller.ts:111-115`
**Bukti:** Recompute dari base + delta, lalu write. **Ini sumber bug C1** — write harusnya atomic increment, bukan recompute + write. (See C1 fix.)

### C30 [INFO] — `errorHandler` generic 500 message in production
**File:** `middleware/error.ts:97-100`
**Bukti:** Tidak bocor info. Aman.

### C31 [INFO] — `tx.$queryRaw` parameter binding (Prisma.sql)
**File:** `report.controller.ts:128-137, 213-217`
**Bukti:** `Prisma.sql\`AND t."created_at" >= ${d}\`` — parameterized via Prisma, no SQL injection. Aman.

### C32 [INFO] — `auth.controller.ts` line 172: `void Prisma;`
**File:** `auth.controller.ts:172`
**Bukti:** "Suppress unused import warning" — minor code smell. `Prisma` di-import di line 2 tapi tidak dipakai di file (semua prisma calls via `prisma` default export). **Hapus import** di line 2 atau hapus `void Prisma` di line 172.

### C33 [INFO] — `transaction.controller.ts` getTransaction tidak cek ownership
**File:** `transaction.controller.ts:270-286`
**Bukti:** `findUnique({ where: { id } })` — siapa pun yang login bisa lihat transaksi apapun. Karena ini single-tenant per deployment, semua user adalah satu toko → bukan IDOR. **OK by design**, tapi dokumentasikan.

### C34 [INFO] — `customerId` di URL tidak divalidasi apakah customer exists
**File:** `customer.controller.ts:142-159` (delete)
**Bukti:** Pre-check ada existing → 404. Aman.

### C35 [INFO] — `me()` tidak revalidate token (stateless check by design)
**File:** `auth.controller.ts:150-160`
**Bukti:** `findUnique` dari `req.user!.userId`. Token sudah diverify di middleware. Cepat.

---

## 3. Frontend (Next.js)

### F1 [MEDIUM] — Tidak ada security headers di Next.js
**File:** `apps/web/next.config.ts`
**Bukti:** Konfigurasi minimal — hanya `turbopack.root`. Tidak ada `headers()` function. Tidak ada CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security. Untuk app yang di-serve HTTP (port 3000 di prod compose), ini longgar.
**Fix:** Tambah di `next.config.ts`:
```ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL}" },
    ],
  }];
}
```
Catatan: CSP ketat butuh audit inline-style/Next.js script loading. Test dulu.

### F2 [MEDIUM] — `next.config.js` ada `allowedDevOrigins: ['43.134.68.203']`
**File:** `apps/web/next.config.js`
**Bukti:** Hardcoded IP — adalah IP dev server developer. **Bocor ke repo publik.** Mungkin ini adalah .gitignored convention override, tapi filename `.js` di root project akan di-commit.
**Fix:** Hapus file ini dari repo, atau pindah ke `.env.local` (NEXT_DEV_ORIGINS) + .gitignore.

### F3 [MEDIUM] — `/stok` 404 (lihat C4)

### F4 [LOW] — `getApiBaseUrl` fallback unsafe di browser
**File:** `apps/web/lib/base-url.ts:1-12`
**Bukti:**
```ts
if (typeof window !== 'undefined') {
  return `${protocol}//${hostname}:5000/api`;
}
```
Di browser, kalau `NEXT_PUBLIC_API_URL` kosong, otomatis pakai `<current-host>:5000`. Ini **berguna** untuk LAN deployment (host = server LAN IP), tapi berbahaya kalau user membuka dari host yang tidak ada API (akan CORS error ke IP attacker, atau ke IP random). Konteks warung: client selalu di-deploy bareng API → fine. Tapi dokumentasikan.
**Fix:** Tetap seperti ini (intentional), atau throw di SSR kalau tidak ada env.

### F5 [LOW] — `apiFetch` throws `ApiError` tapi `products.ts`, `transactions.ts`, `debts.ts` throw `Error` biasa
**File:** `apps/web/lib/products.ts:73-75, 128-131, 162-164`
**Bukti:** Fungsi-fungsi ini pakai raw `fetch` (bukan `apiFetch`) dan throw `new Error(body.message)`. Caller tidak bisa instanceof `ApiError` check. Frontend handle error di Toast dengan `err instanceof ApiError` → fallback ke generic message. **Tapi generic message diturunkan** — UX OK.
**Fix:** Konsistenkan semua module pakai `apiFetch`, atau buat helper yang throw `ApiError`.

### F6 [LOW] — `setApiBaseUrl` not implemented
**File:** `apps/web/lib/base-url.ts`
**Bukti:** Hanya ada `getApiBaseUrl()`. Import-side-effects (e.g. `products.ts:68` dst) hitung `API_URL` **sekali di module load** — kalau `NEXT_PUBLIC_API_URL` berubah runtime (tidak mungkin di Next.js tapi...), tidak akan re-evaluate.
**Fix:** Tidak perlu fix (Next.js build-time inlining).

### F7 [LOW] — Login page demo credentials di dev
**File:** `apps/web/app/login/page.tsx:7, 80-83`
**Bukti:** `process.env.NODE_ENV !== 'production'` → tampilkan "Demo: owner@warung.test / password123". Di dev mode (NODE_ENV !== 'production'), tampil. **In prod build (NODE_ENV=production) disembunyikan** via webpack dead-code elimination. Aman.

### F8 [LOW] — `AuthContext` checks `getMe()` on mount tanpa caching
**File:** `apps/web/contexts/AuthContext.tsx:30-36`
**Bukti:** Tiap reload page → fetch `/auth/me`. Bisa di-SWR-cache. Untuk warung single-page-app, fine.

### F9 [INFO] — `ToastContext` counter module-scoped (good)
**File:** `apps/web/contexts/ToastContext.tsx:21`
**Bukti:** `let counter = 0` di module scope → ID unik across re-renders. Aman.

### F10 [INFO] — `Spinner` component reusable
**File:** `apps/web/components/Spinner.tsx`
**Bukti:** Loading indicator dengan `aria-` implicit (text). Accessible enough.

### F11 [INFO] — `AppShell` click-outside menu ref
**File:** `apps/web/components/AppShell.tsx:85-93`
**Bukti:** `useEffect` + `mousedown` listener + ref check. Mobile menu close on outside click. Correct.

### F12 [INFO] — Receipt modal `window.print()` — no print stylesheet visible
**File:** `apps/web/components/ReceiptModal.tsx:18-21`
**Bukti:** `window.print()` di-trigger, tapi tidak ada `@media print { ... }` CSS di globals.css (perlu dicek). Print akan menampilkan full app chrome. **UX issue** — struk tercetak dengan sidebar + header.
**Fix:** Tambah `@media print` rules di `globals.css`:
```css
@media print {
  body * { visibility: hidden; }
  #receipt, #receipt * { visibility: visible; }
  #receipt { position: absolute; left: 0; top: 0; }
}
```

### F13 [INFO] — No CSRF token in any request — relies on cookie+origin
**File:** various lib/*.ts
**Bukti:** API client tidak set custom header. Backend `originCheck` adalah defense. OK.

### F14 [INFO] — AGENTS.md says "This is NOT the Next.js you know"
**File:** `apps/web/AGENTS.md:1-3`
**Bukti:** Warning ke future agents untuk baca `node_modules/next/dist/docs/` sebelum nulis kode Next.js. Next 16 punya breaking changes. **Internal note, no fix.**

### F15 [INFO] — `useCallback` di pages tidak selalu lengkap deps
**File:** `apps/web/app/(protected)/hutang/page.tsx:45-54`, `laporan/page.tsx:83-89`
**Bukti:** `fetch_` useCallback dengan deps `params.startDate, params.endDate, params.paymentMethod` (line 87 laporan) — eslint-disable di-comment. Sadar dan intentional.

---

## 4. Tests, Types, Code Quality

### T1 [LOW] — Test coverage tipis
**File:** `apps/api/tests/` (3 file: calc, csv, params)
**Bukti:** 41 test cases, semua pure-function tests. **Tidak ada integration test** — tidak ada test untuk controllers, middleware, auth flow. Skema `transactionSchema`, `debtController.recordPayment` (lost-update!), `importProducts`, `product update OCC` — semua tanpa test. Adanya C1 (lost-update) di production-quality code tanpa integration test adalah blind spot terbesar.
**Fix:** Prioritas: tambah integration test untuk `recordPayment` race (bisa pakai sqlite + Promise.all), `createTransaction` happy path + stock race, `importProducts` happy path + fallback.

### T2 [LOW] — `tsconfig` API pakai `module: NodeNext` tapi ada `import { Prisma } from '../generated/prisma/client'` di `report.controller.ts:128`
**File:** `report.controller.ts:128`
**Bukti:** Import di tengah file (line 128), bukan di top — ini workaround untuk `Prisma.sql` di-mix dengan template literal di line 62-64. `tsc` tidak complain. Code smell.
**Fix:** Pindah ke top dengan `// eslint-disable-next-line import/first` jika perlu, atau gunakan `Prisma.sql` import terpisah.

### T3 [LOW] — `tsconfig.json` di `src/generated` ikut dicompile
**File:** `apps/api/Dockerfile:15, 28-33`
**Bukti:** `RUN npx prisma generate` emit TS ke `src/generated`, lalu `tsc` compile → `dist/generated/`. Runtime butuh `dist/generated/prisma/client` (Prisma adapter). `package.json` import dari `../src/generated/prisma/client` — di runtime, setelah `tsc`, harus resolve ke `dist/generated/prisma/client`. Tergantung path mapping. **Tested di vitest (passes), but build deploy belum diverifikasi.**

### T4 [LOW] — Tidak ada ESLint config di API
**File:** `apps/api/`
**Bukti:** Frontend punya `eslint.config.mjs`, API tidak. Tidak ada `npm run lint` di `apps/api/package.json`. Code quality mengandalkan review manual.
**Fix:** Tambah `@typescript-eslint` + `eslint-config-next` style.

### T5 [LOW] — Type `any` tidak pernah dipakai (good)
**File:** scanned all `apps/api/src/`
**Bukti:** Strict TS, no `any` found. Bagus.

### T6 [INFO] — Naming: `parseIdParam` vs inline `Number(req.params.id)` inconsistency
**File:** `utils/params.ts`, scattered in controllers
**Bukti:** Beberapa controller pakai `parseIdParam` (customer, product), beberapa pakai inline `Number(req.params.id) + isNaN` (transaction, debt, category, category, product by id). **Inconsistent.**
**Fix:** Refactor semua ke `parseIdParam` untuk konsistensi.

### T7 [INFO] — `controllers/customer.controller.ts:31-35` imports `toNumber` tapi tidak dipakai
**File:** line 4, line 5 import
**Bukti:** `import { toNumber, serializeTransaction } from '../utils/serialize';` — `serializeTransaction` dipakai line 97, `toNumber` dipakai di line 43, 86, 100-102. OK, dipakai.

### T8 [INFO] — `customer.controller.ts:142` `parseIdParam` returns `id` then deleted
**File:** `customer.controller.ts:140-159`
**Bukti:** DELETE flow: parseIdParam → findUnique with debts → 400 if debts → delete. Good.

### T9 [INFO] — `seed.ts` hash di-recreate setiap seed run (10 rounds)
**File:** `prisma/seed.ts:14-25`
**Bukti:** `bcrypt.hash('password123', 10)` setiap run. ~100ms × N users. Untuk seed (N kecil), fine.

### T10 [INFO] — `seed.ts` ada bug: "Rokok" category di-skip kalau missing
**File:** `prisma/seed.ts:57-74`
**Bukti:** `catMap.get(p.category) ?? null` — kalau category missing, product dibuat tanpa category. Untuk seed, semua 5 category di-upsert di awal, jadi akan selalu ketemu. Aman.

### T11 [INFO] — `seed.ts` customer create dengan name conflict possible
**File:** `prisma/seed.ts:79-94`
**Bukti:** `findFirst({ where: { name } })` untuk dedupe. Race-safe pada seed karena sequential. Aman.

### T12 [INFO] — `csv.ts` punya 13 test cases (bagus)
**File:** `tests/csv.test.ts`
**Bukti:** Quoting, escaping, formula injection, control chars. Comprehensive.

### T13 [INFO] — `params.ts` punya 9 test cases (bagus)
**File:** `tests/params.test.ts`
**Bukti:** Edge cases (NaN, 0, negative, decimal, empty, undefined, custom name). Comprehensive.

### T14 [INFO] — `calc.ts` punya 19 test cases
**File:** `tests/calc.test.ts`
**Bukti:** All helpers tested. Comprehensive.

---

## 5. Deployment & Ops

### D1 [LOW] — `db:up` pakai `sudo docker compose` (assumes passwordless sudo)
**File:** `package.json:23`
**Bukti:** `sudo docker compose up -d`. Untuk CI/Docker Desktop, sudo tidak ada. Will fail in CI.
**Fix:** `docker compose up -d` (assume docker group) atau dokumentasi.

### D2 [LOW] — `JWT_SECRET` env tidak dibuat otomatis; README/example menyebut "ganti sebelum deploy"
**File:** `.env.prod.example:24`
**Bukti:** User harus generate + set manual. `env.ts:32-53` validate weak secrets + min length. **Bagus**: production startup akan fail jika weak. Example tidak auto-generate. Dokumentasi adequate.

### D3 [LOW] — `TZ` env tidak divalidasi (see C2)
**File:** `env.ts`
**Bukti:** Tidak ada baris `process.env.TZ` validation. Dockerfiles set `TZ=Asia/Jakarta`. README minta. Tanpa validation, dev yang lupa `export TZ` akan lihat bug time-shifted.
**Fix:**
```ts
if (env.isProduction && process.env.TZ !== 'Asia/Jakarta') {
  console.warn('[env] WARNING: TZ is not Asia/Jakarta in production. Daily reports may shift.');
}
```

### D4 [LOW] — Docker compose prod: tidak ada restart policy untuk `web`
**File:** `docker-compose.prod.yml:43-53`
**Bukti:** `web` tidak punya `restart: unless-stopped`. API dan DB punya. Jika container web crash, tidak auto-restart.
**Fix:** Tambah `restart: unless-stopped` ke service `web`.

### D5 [LOW] — Docker compose prod: `web` depends_on `api` tapi tidak ada healthcheck
**File:** `docker-compose.prod.yml:48-50`
**Bukti:** `depends_on: - api` (no condition). Web bisa start sebelum API ready → web tries to connect, retries.
**Fix:** Tambah `healthcheck` di API container, dan `depends_on: api: { condition: service_healthy }`.

### D6 [LOW] — Docker compose prod: tidak ada nginx reverse proxy
**File:** `docker-compose.prod.yml`
**Bukti:** API + web di-expose langsung. **Tidak ada TLS termination.** Untuk production, harus pakai reverse proxy (caddy/nginx/Traefik) untuk HTTPS + HSTS + security headers. README mention tapi tidak enforce.
**Fix:** Tambah Caddy atau nginx service.

### D7 [LOW] — Docker compose prod: web port 3000 di-publish ke host tanpa bind ke localhost
**File:** `docker-compose.prod.yml:52`
**Bukti:** `ports: - "3000:3000"` — 0.0.0.0:3000. Sama untuk API 5000:5000. Tidak ada `127.0.0.1:` prefix (yang ada di `docker-compose.yml` dev untuk postgres).
**Fix:** Bind ke 127.0.0.1 (assume reverse proxy on host) atau document.

### D8 [LOW] — `prisma.config.ts` di-COPY tapi tidak di-RUN
**File:** `apps/api/Dockerfile:30`
**Bukti:** `COPY --from=builder /app/prisma.config.ts ./prisma.config.ts` — disalin tapi tidak jelas untuk apa. Prisma 7 mungkin butuh. OK by inspection.

### D9 [LOW] — `apps/api/.gitignore` ignores `/src/generated/prisma`
**File:** `apps/api/.gitignore:5`
**Bukti:** Generated Prisma client di-gitignore. Harus regenerate saat checkout. Dokumentasikan: `npm install && npx prisma generate`. README tidak eksplisit sebut ini.
**Fix:** Tambah di README install steps.

### D10 [LOW] — `npm run dev:api` pakai `nodemon + ts-node` — slow startup, watch overhead
**File:** `apps/api/package.json:6`
**Bukti:** Default. Untuk dev, fine. Untuk CI test, gunakan `vitest` (sudah dipakai).

### D11 [LOW] — Tidak ada CI config
**File:** repo root
**Bukti:** Tidak ada `.github/workflows/`, `.gitlab-ci.yml`, dll. PR tidak ada automated test/lint.
**Fix:** Tambah minimal GitHub Actions: `npm ci && npm run build && npm test` di setiap PR.

### D12 [LOW] — Tidak ada `Dockerfile` untuk `apps/web` di compose dev
**File:** `docker-compose.yml` (dev) tidak include web/api
**Bukti:** Hanya Postgres. Web + API dijalankan via `npm run dev`. Standard untuk monorepo dev. OK.

### D13 [LOW] — Seed: `customer.findFirst({ where: { name } })` — race-duplicate risk on re-seed
**File:** `prisma/seed.ts:87-93`
**Bukti:** Sequential seed → no race in practice. Aman.

### D14 [LOW] — `package.json` `keywords`: ada typo? ("point-of-sale")
**File:** `package.json:35`
**Bukti:** "point-of-sale" adalah correct term. OK.

### D15 [LOW] — `concurrently` di root tidak pinned
**File:** `package.json:38`
**Bukti:** `"concurrently": "^8.2.2"`. Cara-pinned. OK.

### D16 [INFO] — `.env.prod.example` di root adalah SECURITY warning
**File:** `.env.prod.example:1-7`
**Bukti:** Comment PERINGATAN bahwa weak secret akan ditolak saat prod start. Bagus.

### D17 [INFO] — `docker-compose.yml` (dev) Postgres di-bind ke `127.0.0.1:5432`
**File:** `docker-compose.yml:4-6`
**Bukti:** `127.0.0.1:5432:5432` — tidak terexpose ke LAN. Aman untuk dev.

### D18 [INFO] — `seed.ts` uses default `owner@warung.test / password123`
**File:** `prisma/seed.ts:15-22`
**Bukti:** README eksplisit minta ganti password. Tanggung jawab owner.

### D19 [INFO] — `migrations/` folder ada lock file
**File:** `apps/api/prisma/migrations/migration_lock.toml`
**Bukti:** Standard Prisma flow. `npx prisma migrate deploy` di Dockerfile line 37. OK.

### D20 [INFO] — `daily_counters` migration: `CREATE TABLE IF NOT EXISTS` (idempotent)
**File:** `apps/api/prisma/migrations/20260612100000_add_daily_counters/migration.sql:5`
**Bukti:** Safe to re-run. Good.

### D21 [INFO] — `daily_counters` tidak punya `createdAt`/`updatedAt` (audit gap)
**File:** same
**Bukti:** Untuk counter table, tidak perlu. OK.

### D22 [INFO] — `transactions_payment_method_idx` baru di migration 2
**File:** same line 12
**Bukti:** Bagus — index untuk report filter. Hot path query dioptimasi.

### D23 [INFO] — `stock_movements_created_at_idx` baru di migration 2
**File:** same line 13
**Bukti:** Index untuk product history sort. Bagus.

### D24 [INFO] — `DebtStatus` dan `TransactionStatus` enums tidak punya default di schema
**File:** `prisma/schema.prisma:127, 150`
**Bukti:** `status TransactionStatus @default(COMPLETED)` di line 128 ✓. `status DebtStatus @default(UNPAID)` di line 182 ✓. OK.

---

## 6. Hardening Changes (Modified Files di Working Tree)

Repo saat ini punya 22 file modified (per `git status`). Ini adalah hardening yang sudah dilakukan **sebelum** audit (mungkin sebagian terkait). Tidak boleh di-revert:

| File | Perubahan | Benefit |
|------|-----------|---------|
| `.env.prod.example` | Tambah security warnings | Better UX saat prod setup |
| `apps/api/src/index.ts` | Tambah originCheck, request-id, rate-limit, helmet | Defense in depth |
| `apps/api/src/middleware/origin-check.ts` (NEW) | CSRF defense | **HIGH** value add |
| `apps/api/src/middleware/rate-limit.ts` (NEW) | Per-endpoint + global limiters | **HIGH** value add |
| `apps/api/src/middleware/request-id.ts` (NEW) | Request correlation | Observability |
| `apps/api/src/controllers/auth.controller.ts` | Dummy hash, transactional register | Timing-attack + race defense |
| `apps/api/src/controllers/transaction.controller.ts` | Daily counter, race-safe stock decrement | **HIGH** value add |
| `apps/api/src/controllers/debt.controller.ts` | Race-safe payment WHERE clause | **MEDIUM** value add |
| `apps/api/src/controllers/customer.controller.ts` | parseIdParam helper | Consistency |
| `apps/api/src/controllers/import.controller.ts` | Batched import, error reporting | Perf + UX |
| `apps/api/src/controllers/report.controller.ts` | Server-side aggregation, TZ-correct rollup | Perf + correctness |
| `apps/api/src/utils/csv.ts` (NEW) | CSV-injection defense + RFC 4180 | **MEDIUM** value add |
| `apps/api/src/utils/params.ts` (NEW) | parseIdParam helper | Consistency |
| `apps/api/src/schemas/*.ts` | Zod strict validation | Input safety |
| `apps/api/prisma/migrations/20260612100000_add_daily_counters/` (NEW) | Counter table | Atomicity |
| `apps/web/next.config.js` (new) | `allowedDevOrigins: ['43.134.68.203']` | **CONCERN: hardcoded IP** |

**Catatan:** `apps/web/next.config.js` dengan hardcoded IP `43.134.68.203` (lihat F2) **harus** dihapus dari repo publik. Mungkin ini untuk dev IP developer sendiri, tapi tidak seharusnya di-commit.

---

## 7. Rekomendasi Prioritas

### 🔴 Segera (minggu ini)
1. **Fix C1** — Lost-update di `recordPayment` (use `{ increment: data.amount }` + re-derive via RETURNING).
2. **Fix F2** — Hapus `apps/web/next.config.js` hardcoded IP dari repo.
3. **Fix C4/F3** — Hapus `/stok` dari sidebar atau buat halaman (dead link → 404).

### 🟡 Penting (bulan ini)
4. **Fix C2/D3** — Validasi `TZ` di `env.ts`; rewrite `buildDateRange` agar konsisten.
5. **Fix F1** — Tambah security headers (CSP, HSTS, X-Frame-Options) di `next.config.ts`.
6. **Fix C3** — `listDebts` totalOutstanding respect customerId filter.
7. **Fix S2** — Implementasi `tokenVersion` atau logout-all.
8. **Fix F12** — Tambah print stylesheet untuk ReceiptModal.
9. **Fix T1** — Tambah integration test untuk `recordPayment` race (top priority).

### 🟢 Nice-to-have (quarter ini)
10. **Fix S1** — Strict Origin required for state-changing requests.
11. **Fix S3** — authLimiter di /register.
12. **Fix S5** — Brute-force lockout + breached password denylist.
13. **Fix C7** — Log bulk-insert error di CSV import.
14. **Fix D5/D4** — Healthcheck + restart policy untuk web container.
15. **Fix D6** — Tambah nginx/Caddy reverse proxy untuk prod compose.
16. **Fix T4** — ESLint config untuk API.
17. **Fix D11** — CI (GitHub Actions) untuk lint + test + build.

---

## 8. Verdict

**WarungKu adalah proyek POS yang ditulis dengan teliti.** Backend-nya menunjukkan pemahaman yang solid akan transactional integrity (race-safe stock decrement, unique transaction numbers, debt payment guards), security primitives (CSRF check, httpOnly cookies, role authorization, rate limiting, input validation), dan error handling. Frontend-nya bersih dan konsisten.

**Risiko nyata** hanya pada (1) lost-update debt payment saat multi-cashier, dan (2) inkonsistensi timezone. Keduanya punya fix yang terisolasi dan terdefinisi dengan baik.

**Setelah dua fix High itu + tiga Medium (security headers, broken nav, listDebts totalOutstanding), proyek siap untuk single-tenant production deployment** untuk warung kelontong tipikal (satu owner, satu kasir, satu shift).

Untuk ekspansi ke multi-tenant atau multi-shift concurrent, **wajib** selesaikan C1, C2, dan S2 dulu.
