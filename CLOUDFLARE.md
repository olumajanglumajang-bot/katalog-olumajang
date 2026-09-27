# Panduan Deployment Cloudflare (Backup Deployment)

Project **Katalog Olumajang** sekarang mendukung penuh deployment ke **Cloudflare Workers** dan **Cloudflare Pages** sebagai backup tanpa mengganggu deployment **Netlify**.

---

## Opsi 1: Cloudflare Workers (Direkomendasikan via Wrangler)

Worker entry point: `src/worker/index.ts`  
Konfigurasi: `wrangler.toml` dan `wrangler.json`  
Static Assets: Otomatis menyajikan folder `dist` hasil build Vite.

### Langkah Deploy:
1. Pastikan project sudah dibuild:
   ```bash
   npm run build
   ```
2. Jalankan deployment ke Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```
   atau menggunakan script package.json:
   ```bash
   npm run cf:deploy
   ```

### (Opsional) Mengaktifkan Cloudflare KV untuk Penyimpanan Data Permanen:
Secara default, worker memiliki fallback cerdas ke in-memory cache dan seed data `data/catalog.json`. Agar perubahan data di admin (tambah/edit/hapus warung & foto) tersimpan permanen di multi-region edge Cloudflare:
1. Buat KV namespace:
   ```bash
   npx wrangler kv:namespace create CATALOG_KV
   ```
2. Salin `id` hasil pembuatan namespace ke dalam `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "CATALOG_KV"
   id = "PASTE_KV_NAMESPACE_ID_DISINI"
   ```
3. Deploy ulang dengan `npm run cf:deploy`.

---

## Opsi 2: Cloudflare Pages (via Git / Dashboard)

Jika Anda menghubungkan repository GitHub ke **Cloudflare Pages**:
- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Functions directory**: `functions` (sudah disediakan di `functions/api/[[catchall]].ts`)
- **Route rules**: `public/_routes.json` otomatis mengarahkan `/api/*` ke Functions dan aset lainnya langsung ke CDN super cepat.

---

## Variabel Lingkungan (Environment Variables)

Variabel lingkungan yang didukung:
- `ADMIN_PASSWORD` (default: `231288`)
- `ADMIN_SALT` (default: `olumajang_secret_salt_2026`)

Dapat diatur melalui dashboard Cloudflare Workers/Pages pada menu **Settings > Variables and Secrets**, atau diatur di file `wrangler.toml`.

---

## Fitur yang Didukung Penuh di Cloudflare:
1. **GET /api/warung**: Katalog publik berurutan A-Z (tidak pernah 404).
2. **GET /api/warung/:id**: Detail warung dan menu.
3. **POST /api/admin/login**: Autentikasi admin dengan SHA-256 dan token HMAC.
4. **GET /api/admin/verify**: Verifikasi token admin.
5. **POST /api/warung**: Tambah warung baru (admin).
6. **PUT /api/warung/:id**: Edit jadwal, alamat, nama, dan status warung (admin).
7. **DELETE /api/warung/:id**: Hapus warung, logo, dan seluruh fotonya (admin).
8. **POST /api/warung/:id/logo**: Upload logo warung (Base64 / Multipart, admin).
9. **DELETE /api/warung/:id/logo**: Hapus logo warung (admin).
10. **POST /api/warung/:id/photos**: Upload foto menu (Base64 / Multipart, batas 50 foto, admin).
11. **PUT /api/warung/:id/photos/reorder**: Urutkan ulang foto (admin).
12. **DELETE /api/warung/:id/photos/:photoId**: Hapus foto individual (admin).
13. **CORS**: Header Access-Control lengkap untuk panggilan lintas domain.
