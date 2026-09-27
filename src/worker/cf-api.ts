import seedCatalog from '../../data/catalog.json';

export interface Env {
  ADMIN_PASSWORD?: string;
  ADMIN_SALT?: string;
  CATALOG_KV?: {
    get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any>;
    put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<void>;
    delete(key: string): Promise<void>;
  };
  ASSETS?: {
    fetch(request: Request | string): Promise<Response>;
  };
}

const DEFAULT_ADMIN_PASSWORD = '231288';
const DEFAULT_SALT = 'olumajang_secret_salt_2026';
const KV_KEY = 'catalog_data';

// In-memory cache for ultra-fast response within warm worker instances
let inMemoryCatalog: { warungs: any[] } | null = null;

// CORS headers for all responses
const corsHeaders: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Response helper
function createResponse(statusCode: number, data: any, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      ...(extraHeaders || {}),
    },
  });
}

// Web Crypto SHA-256 Digest
async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Web Crypto HMAC-SHA256
async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  const sigArr = Array.from(new Uint8Array(sigBuf));
  return sigArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Stateless HMAC-SHA256 Token Verification (14-day expiry)
async function verifyAdminAuth(authHeader: string | null | undefined, salt: string): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;
  const expectedSig = await hmacSha256Hex(salt, payload);

  if (!timingSafeEqual(signature, expectedSig)) return false;

  // 14-day expiry check
  const timestampStr = payload.split('-')[0];
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 14 * 24 * 60 * 60 * 1000) {
    return false;
  }

  return true;
}

// Storage Manager with Cloudflare KV & In-Memory Fallback
async function getStoredCatalog(env: Env): Promise<{ warungs: any[] }> {
  if (inMemoryCatalog && Array.isArray(inMemoryCatalog.warungs) && inMemoryCatalog.warungs.length > 0) {
    return inMemoryCatalog;
  }

  // 1. Try Cloudflare Workers KV
  if (env.CATALOG_KV) {
    try {
      const kvData = await env.CATALOG_KV.get(KV_KEY, 'json');
      if (
        kvData &&
        typeof kvData === 'object' &&
        Array.isArray((kvData as any).warungs) &&
        (kvData as any).warungs.length > 0
      ) {
        inMemoryCatalog = kvData as { warungs: any[] };
        return inMemoryCatalog;
      }
    } catch (err) {
      console.warn('[Cloudflare KV] Gagal membaca data catalog:', err);
    }
  }

  // 2. Fallback to seed catalog
  inMemoryCatalog = JSON.parse(JSON.stringify(seedCatalog)) as { warungs: any[] };
  return inMemoryCatalog;
}

async function saveStoredCatalog(env: Env, data: { warungs: any[] }): Promise<void> {
  inMemoryCatalog = data;

  // Save to Cloudflare Workers KV
  if (env.CATALOG_KV) {
    try {
      await env.CATALOG_KV.put(KV_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[Cloudflare KV] Gagal menyimpan data catalog:', err);
    }
  }
}

// Convert ArrayBuffer to Base64 efficiently in chunks
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// Convert File/Blob to Base64 Data URL
async function fileToDataUrl(file: File | Blob, defaultMime = 'image/jpeg'): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const mimeType = file.type || defaultMime;
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Universal Cloudflare API Request Handler
 * Compatible with Cloudflare Workers and Cloudflare Pages Functions
 */
export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  // Handle CORS Preflight
  if (request.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // Normalize subpath by stripping /api prefix
  let subpath = url.pathname.replace(/^\/api/, '');
  if (!subpath.startsWith('/')) subpath = '/' + subpath;
  if (subpath.length > 1 && subpath.endsWith('/')) {
    subpath = subpath.slice(0, -1);
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const secretSalt = env.ADMIN_SALT || DEFAULT_SALT;

  try {
    // -------------------------------------------------------------
    // 1. ADMIN AUTHENTICATION
    // -------------------------------------------------------------
    if (subpath === '/admin/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const inputPass = String(body.password || '').trim();
      const defaultAdminPass = env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

      const inputHash = await sha256Hex(inputPass);
      const adminPassHash = await sha256Hex(defaultAdminPass);

      const isMatch = timingSafeEqual(inputHash, adminPassHash);
      if (!isMatch) {
        return createResponse(401, { error: 'Kata sandi admin salah. Silakan coba lagi.' });
      }

      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const randomHex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const payload = `${Date.now()}-${randomHex}`;
      const signature = await hmacSha256Hex(secretSalt, payload);
      const token = `${payload}.${signature}`;

      return createResponse(200, {
        success: true,
        token,
        message: 'Berhasil login sebagai admin.',
      });
    }

    if (subpath === '/admin/verify' && method === 'GET') {
      const isValid = await verifyAdminAuth(authHeader, secretSalt);
      return createResponse(200, { authenticated: isValid });
    }

    if (subpath === '/admin/logout' && method === 'POST') {
      return createResponse(200, { success: true, message: 'Berhasil keluar.' });
    }

    // -------------------------------------------------------------
    // 2. GET WARUNGS (PUBLIC - GUARANTEED NEVER TO 404!)
    // -------------------------------------------------------------
    if (subpath === '/warung' && method === 'GET') {
      const catalog = await getStoredCatalog(env);
      const warungs = [...(catalog.warungs || [])];
      // Strict A-Z sort based on uppercase normalized warung name
      warungs.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' }));
      return createResponse(200, { warungs });
    }

    // -------------------------------------------------------------
    // 3. GET SINGLE WARUNG
    // -------------------------------------------------------------
    const getSingleMatch = subpath.match(/^\/warung\/([^\/]+)$/);
    if (getSingleMatch && method === 'GET') {
      const warungId = getSingleMatch[1];
      const catalog = await getStoredCatalog(env);
      const warung = (catalog.warungs || []).find((w: any) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }
      return createResponse(200, { warung });
    }

    // -------------------------------------------------------------
    // 4. CREATE WARUNG (ADMIN ONLY)
    // -------------------------------------------------------------
    if (subpath === '/warung' && method === 'POST') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const body = await request.json().catch(() => ({}));
      const rawNama = String(body.nama || '').trim();
      if (!rawNama) {
        return createResponse(400, { error: 'Nama warung wajib diisi.' });
      }

      const catalog = await getStoredCatalog(env);
      const randomPart = Math.random().toString(36).substring(2, 6);
      const newWarung = {
        id: `warung-${Date.now().toString(36)}-${randomPart}`,
        nama: rawNama.toUpperCase(),
        logo: String(body.logo || '').trim(),
        alamat: String(body.alamat || '').trim(),
        maps_url: String(body.maps_url || '').trim(),
        kategori: String(body.kategori || 'Makanan & Minuman').trim(),
        senin_buka: String(body.senin_buka || '').trim(),
        senin_tutup: String(body.senin_tutup || '').trim(),
        senin_libur: Boolean(body.senin_libur),
        selasa_buka: String(body.selasa_buka || '').trim(),
        selasa_tutup: String(body.selasa_tutup || '').trim(),
        selasa_libur: Boolean(body.selasa_libur),
        rabu_buka: String(body.rabu_buka || '').trim(),
        rabu_tutup: String(body.rabu_tutup || '').trim(),
        rabu_libur: Boolean(body.rabu_libur),
        kamis_buka: String(body.kamis_buka || '').trim(),
        kamis_tutup: String(body.kamis_tutup || '').trim(),
        kamis_libur: Boolean(body.kamis_libur),
        jumat_buka: String(body.jumat_buka || '').trim(),
        jumat_tutup: String(body.jumat_tutup || '').trim(),
        jumat_libur: Boolean(body.jumat_libur),
        sabtu_buka: String(body.sabtu_buka || '').trim(),
        sabtu_tutup: String(body.sabtu_tutup || '').trim(),
        sabtu_libur: Boolean(body.sabtu_libur),
        minggu_buka: String(body.minggu_buka || '').trim(),
        minggu_tutup: String(body.minggu_tutup || '').trim(),
        minggu_libur: Boolean(body.minggu_libur),
        status: body.status === 'tutup' ? 'tutup' : 'buka',
        is_active: body.is_active !== false,
        daftar_foto: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      catalog.warungs.push(newWarung);
      await saveStoredCatalog(env, catalog);

      return createResponse(201, { success: true, warung: newWarung });
    }

    // -------------------------------------------------------------
    // 5. UPDATE WARUNG (ADMIN ONLY)
    // -------------------------------------------------------------
    const updateMatch = subpath.match(/^\/warung\/([^\/]+)$/);
    if (updateMatch && method === 'PUT') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = updateMatch[1];
      const catalog = await getStoredCatalog(env);
      const index = (catalog.warungs || []).findIndex((w: any) => w.id === warungId);
      if (index === -1) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      const target = catalog.warungs[index];
      const b = await request.json().catch(() => ({}));

      if (b.nama !== undefined) target.nama = String(b.nama).trim().toUpperCase();
      if (b.alamat !== undefined) target.alamat = String(b.alamat).trim();
      if (b.maps_url !== undefined) target.maps_url = String(b.maps_url).trim();
      if (b.kategori !== undefined) target.kategori = String(b.kategori).trim();
      if (b.logo !== undefined) target.logo = String(b.logo).trim();

      const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'] as const;
      for (const day of days) {
        if (b[`${day}_buka`] !== undefined) target[`${day}_buka`] = String(b[`${day}_buka`]).trim();
        if (b[`${day}_tutup`] !== undefined) target[`${day}_tutup`] = String(b[`${day}_tutup`]).trim();
        if (b[`${day}_libur`] !== undefined) target[`${day}_libur`] = Boolean(b[`${day}_libur`]);
      }

      if (b.status !== undefined) target.status = b.status === 'tutup' ? 'tutup' : 'buka';
      if (b.is_active !== undefined) target.is_active = Boolean(b.is_active);
      target.updated_at = new Date().toISOString();

      catalog.warungs[index] = target;
      await saveStoredCatalog(env, catalog);

      return createResponse(200, { success: true, warung: target });
    }

    // -------------------------------------------------------------
    // 6. DELETE WARUNG (ADMIN ONLY)
    // -------------------------------------------------------------
    const deleteWarungMatch = subpath.match(/^\/warung\/([^\/]+)$/);
    if (deleteWarungMatch && method === 'DELETE') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = deleteWarungMatch[1];
      const catalog = await getStoredCatalog(env);
      const initialCount = catalog.warungs.length;
      catalog.warungs = catalog.warungs.filter((w: any) => w.id !== warungId);

      if (catalog.warungs.length === initialCount) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      await saveStoredCatalog(env, catalog);
      return createResponse(200, {
        success: true,
        message: 'Warung dan seluruh fotonya berhasil dihapus.',
      });
    }

    // -------------------------------------------------------------
    // 7. UPLOAD WARUNG LOGO (ADMIN ONLY)
    // -------------------------------------------------------------
    const uploadLogoMatch = subpath.match(/^\/warung\/([^\/]+)\/logo$/);
    if (uploadLogoMatch && method === 'POST') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = uploadLogoMatch[1];
      const catalog = await getStoredCatalog(env);
      const warung = (catalog.warungs || []).find((w: any) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      let logoDataUrl = '';
      const contentType = request.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const body = await request.json().catch(() => ({}));
        logoDataUrl = body.logoDataUrl || body.logo || '';
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('logo') || formData.get('file');
        if (file && typeof file === 'object' && 'arrayBuffer' in file) {
          logoDataUrl = await fileToDataUrl(file as File);
        }
      }

      if (!logoDataUrl) {
        return createResponse(400, { error: 'Data logo tidak ditemukan.' });
      }

      warung.logo = logoDataUrl;
      warung.updated_at = new Date().toISOString();
      await saveStoredCatalog(env, catalog);

      return createResponse(200, {
        success: true,
        logoUrl: warung.logo,
        warung,
        message: 'Logo warung berhasil diunggah.',
      });
    }

    // -------------------------------------------------------------
    // 8. DELETE WARUNG LOGO (ADMIN ONLY)
    // -------------------------------------------------------------
    const deleteLogoMatch = subpath.match(/^\/warung\/([^\/]+)\/logo$/);
    if (deleteLogoMatch && method === 'DELETE') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = deleteLogoMatch[1];
      const catalog = await getStoredCatalog(env);
      const warung = (catalog.warungs || []).find((w: any) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      warung.logo = '';
      warung.updated_at = new Date().toISOString();
      await saveStoredCatalog(env, catalog);

      return createResponse(200, {
        success: true,
        warung,
        message: 'Logo warung berhasil dihapus.',
      });
    }

    // -------------------------------------------------------------
    // 9. UPLOAD WARUNG PHOTOS (ADMIN ONLY, 50 PHOTOS LIMIT)
    // -------------------------------------------------------------
    const uploadPhotosMatch = subpath.match(/^\/warung\/([^\/]+)\/photos$/);
    if (uploadPhotosMatch && method === 'POST') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = uploadPhotosMatch[1];
      const catalog = await getStoredCatalog(env);
      const warung = (catalog.warungs || []).find((w: any) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      if (!Array.isArray(warung.daftar_foto)) {
        warung.daftar_foto = [];
      }

      const currentCount = warung.daftar_foto.length;
      const remainingQuota = Math.max(0, 50 - currentCount);

      if (remainingQuota <= 0) {
        return createResponse(400, {
          error: 'MAKSIMAL 50 FOTO UNTUK SATU WARUNG.',
          currentCount,
          maxLimit: 50,
        });
      }

      let incomingPhotos: Array<{ dataUrl: string; fileName?: string }> = [];
      const contentType = request.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const body = await request.json().catch(() => ({}));
        if (Array.isArray(body.photos)) {
          incomingPhotos = body.photos.map((p: any) => ({
            dataUrl: p.dataUrl || p.file_url || p.url,
            fileName: p.fileName || p.file_name || 'menu_foto.jpg',
          }));
        } else if (body.dataUrl) {
          incomingPhotos = [{ dataUrl: body.dataUrl, fileName: body.fileName || 'menu_foto.jpg' }];
        }
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const files = formData.getAll('photos');
        for (const item of files) {
          if (item && typeof item === 'object' && 'arrayBuffer' in item) {
            const file = item as File;
            const dataUrl = await fileToDataUrl(file);
            incomingPhotos.push({
              dataUrl,
              fileName: file.name || 'menu_foto.jpg',
            });
          }
        }
        if (incomingPhotos.length === 0) {
          const single = formData.get('photo') || formData.get('file');
          if (single && typeof single === 'object' && 'arrayBuffer' in single) {
            const file = single as File;
            const dataUrl = await fileToDataUrl(file);
            incomingPhotos.push({
              dataUrl,
              fileName: file.name || 'menu_foto.jpg',
            });
          }
        }
      }

      if (incomingPhotos.length === 0) {
        return createResponse(400, { error: 'Tidak ada file gambar yang diunggah.' });
      }

      const accepted = incomingPhotos.slice(0, remainingQuota);
      const rejectedCount = incomingPhotos.length - accepted.length;

      const newPhotos = accepted.map((item, idx) => ({
        id: `p-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        warung_id: warung.id,
        file_url: item.dataUrl,
        file_name: item.fileName || `foto_${currentCount + idx + 1}.jpg`,
        urutan: currentCount + idx + 1,
        created_at: new Date().toISOString(),
      }));

      warung.daftar_foto.push(...newPhotos);
      warung.updated_at = new Date().toISOString();
      await saveStoredCatalog(env, catalog);

      return createResponse(200, {
        success: true,
        message: `${newPhotos.length} foto berhasil ditambahkan.${
          rejectedCount > 0 ? ` (${rejectedCount} foto ditolak karena melebihi batas 50 foto)` : ''
        }`,
        acceptedCount: newPhotos.length,
        rejectedCount,
        addedPhotos: newPhotos,
        totalPhotos: warung.daftar_foto.length,
        warung,
      });
    }

    // -------------------------------------------------------------
    // 10. REORDER WARUNG PHOTOS (ADMIN ONLY)
    // -------------------------------------------------------------
    const reorderMatch = subpath.match(/^\/warung\/([^\/]+)\/photos\/reorder$/);
    if (reorderMatch && method === 'PUT') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = reorderMatch[1];
      const catalog = await getStoredCatalog(env);
      const warung = (catalog.warungs || []).find((w: any) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      const body = await request.json().catch(() => ({}));
      const { photoIds } = body;
      if (!Array.isArray(photoIds)) {
        return createResponse(400, { error: 'Urutan foto (photoIds array) diperlukan.' });
      }

      const photoMap = new Map<string, any>((warung.daftar_foto || []).map((p: any) => [p.id, p]));
      const reordered: any[] = [];

      photoIds.forEach((id: string, index: number) => {
        const p = photoMap.get(id);
        if (p) {
          p.urutan = index + 1;
          reordered.push(p);
          photoMap.delete(id);
        }
      });

      photoMap.forEach((p: any) => {
        p.urutan = reordered.length + 1;
        reordered.push(p);
      });

      warung.daftar_foto = reordered;
      warung.updated_at = new Date().toISOString();
      await saveStoredCatalog(env, catalog);

      return createResponse(200, { success: true, warung });
    }

    // -------------------------------------------------------------
    // 11. DELETE SINGLE WARUNG PHOTO (ADMIN ONLY)
    // -------------------------------------------------------------
    const deletePhotoMatch = subpath.match(/^\/warung\/([^\/]+)\/photos\/([^\/]+)$/);
    if (deletePhotoMatch && method === 'DELETE') {
      if (!(await verifyAdminAuth(authHeader, secretSalt))) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = deletePhotoMatch[1];
      const photoId = deletePhotoMatch[2];

      const catalog = await getStoredCatalog(env);
      const warung = (catalog.warungs || []).find((w: any) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      const initialLength = (warung.daftar_foto || []).length;
      warung.daftar_foto = (warung.daftar_foto || []).filter((p: any) => p.id !== photoId);

      if (warung.daftar_foto.length === initialLength) {
        return createResponse(404, { error: 'Foto tidak ditemukan.' });
      }

      warung.daftar_foto.forEach((p: any, idx: number) => {
        p.urutan = idx + 1;
      });
      warung.updated_at = new Date().toISOString();
      await saveStoredCatalog(env, catalog);

      return createResponse(200, {
        success: true,
        message: 'Foto berhasil dihapus.',
        totalPhotos: warung.daftar_foto.length,
        warung,
      });
    }

    // Fallback 404 for unknown endpoints
    return createResponse(404, { error: `Endpoint '${subpath}' [${method}] tidak ditemukan.` });
  } catch (err: any) {
    console.error('[Cloudflare API Error]', err);
    return createResponse(500, {
      error: 'Terjadi kesalahan pada server backend Cloudflare Worker.',
      details: err?.message || String(err),
    });
  }
}
