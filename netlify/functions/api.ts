import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import crypto from 'crypto';
import seedCatalog from '../../data/catalog.json';

const ADMIN_PASSWORD_RAW = process.env.ADMIN_PASSWORD || '231288';
const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update(ADMIN_PASSWORD_RAW.trim()).digest('hex');
const SECRET_SALT = process.env.ADMIN_SALT || 'olumajang_secret_salt_2026';
const STORE_NAME = 'olumajang-catalog-store';
const KEY_NAME = 'catalog_data';

// In-memory cache for ultra-fast response within warm containers
let inMemoryCatalog: { warungs: any[] } | null = null;

// CORS headers for all responses
const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Response helper
function createResponse(statusCode: number, data: any) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

// Netlify Blobs & Fallback Storage
async function getStoredCatalog(): Promise<{ warungs: any[] }> {
  if (inMemoryCatalog && Array.isArray(inMemoryCatalog.warungs) && inMemoryCatalog.warungs.length > 0) {
    return inMemoryCatalog;
  }

  // 1. Try Netlify Blobs if available in Netlify environment
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: STORE_NAME, consistency: 'strong' });
    const raw = await store.get(KEY_NAME, { type: 'json' });
    if (raw && typeof raw === 'object' && Array.isArray((raw as any).warungs) && (raw as any).warungs.length > 0) {
      inMemoryCatalog = raw as { warungs: any[] };
      return inMemoryCatalog;
    }
  } catch (err) {
    // Netlify blobs might not be configured or local
  }

  // 2. Try /tmp file storage
  try {
    const fs = await import('fs');
    const path = await import('path');
    const tmpFile = path.join('/tmp', 'olumajang_catalog.json');
    if (fs.existsSync(tmpFile)) {
      const content = fs.readFileSync(tmpFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.warungs) && parsed.warungs.length > 0) {
        inMemoryCatalog = parsed as { warungs: any[] };
        return inMemoryCatalog;
      }
    }
  } catch {}

  // 3. Fallback to seed catalog
  inMemoryCatalog = JSON.parse(JSON.stringify(seedCatalog)) as { warungs: any[] };
  return inMemoryCatalog;
}

async function saveStoredCatalog(data: { warungs: any[] }): Promise<void> {
  inMemoryCatalog = data;

  // 1. Save to Netlify Blobs
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name: STORE_NAME, consistency: 'strong' });
    await store.setJSON(KEY_NAME, data);
  } catch (err) {
    // Continue to /tmp fallback
  }

  // 2. Save to /tmp
  try {
    const fs = await import('fs');
    const path = await import('path');
    const tmpFile = path.join('/tmp', 'olumajang_catalog.json');
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

// Stateless HMAC-SHA256 Token Verification
function verifyAdminAuth(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1];
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');

  // Verify HMAC match
  if (signature.length !== expectedSig.length) return false;
  const isMatch = crypto.timingSafeEqual(Buffer.from(signature, 'utf-8'), Buffer.from(expectedSig, 'utf-8'));
  if (!isMatch) return false;

  // Check 14-day expiry
  const timestampStr = payload.split('-')[0];
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 14 * 24 * 60 * 60 * 1000) {
    return false;
  }

  return true;
}

// Helper to parse multipart/form-data into Data URLs
function parseMultipartFiles(
  bodyBuffer: Buffer,
  boundary: string
): Array<{ name: string; filename: string; mimeType: string; dataUrl: string }> {
  const result: Array<{ name: string; filename: string; mimeType: string; dataUrl: string }> = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let start = 0;

  while (true) {
    const idx = bodyBuffer.indexOf(boundaryBuffer, start);
    if (idx === -1) break;

    if (start > 0) {
      const part = bodyBuffer.subarray(start, idx);
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const headerStr = part.subarray(0, headerEnd).toString('utf-8');
        let bodyPart = part.subarray(headerEnd + 4);
        if (bodyPart.subarray(bodyPart.length - 2).toString() === '\r\n') {
          bodyPart = bodyPart.subarray(0, bodyPart.length - 2);
        }

        const nameMatch = headerStr.match(/name="([^"]+)"/);
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        const mimeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

        if (filenameMatch && bodyPart.length > 0) {
          const mimeType = mimeMatch ? mimeMatch[1].trim() : 'image/jpeg';
          const base64 = bodyPart.toString('base64');
          result.push({
            name: nameMatch ? nameMatch[1] : 'file',
            filename: filenameMatch[1],
            mimeType,
            dataUrl: `data:${mimeType};base64,${base64}`,
          });
        }
      }
    }
    start = idx + boundaryBuffer.length;
  }

  return result;
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  const method = event.httpMethod.toUpperCase();

  // Normalize path by stripping Netlify and API prefixes
  let subpath = (event.path || '')
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '');

  if (!subpath.startsWith('/')) subpath = '/' + subpath;
  if (subpath.length > 1 && subpath.endsWith('/')) {
    subpath = subpath.slice(0, -1);
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;

  try {
    // -------------------------------------------------------------
    // 1. ADMIN AUTHENTICATION
    // -------------------------------------------------------------
    if (subpath === '/admin/login' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const inputPass = String(body.password || '').trim();

      const inputHash = crypto.createHash('sha256').update(inputPass).digest('hex');
      const isMatch = crypto.timingSafeEqual(
        Buffer.from(inputHash, 'utf-8'),
        Buffer.from(ADMIN_PASSWORD_HASH, 'utf-8')
      );

      if (!isMatch) {
        return createResponse(401, { error: 'Kata sandi admin salah. Silakan coba lagi.' });
      }

      const payload = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
      const signature = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
      const token = `${payload}.${signature}`;

      return createResponse(200, {
        success: true,
        token,
        message: 'Berhasil login sebagai admin.',
      });
    }

    if (subpath === '/admin/verify' && method === 'GET') {
      const isValid = verifyAdminAuth(authHeader);
      return createResponse(200, { authenticated: isValid });
    }

    if (subpath === '/admin/logout' && method === 'POST') {
      return createResponse(200, { success: true, message: 'Berhasil keluar.' });
    }

    // -------------------------------------------------------------
    // 2. GET WARUNGS (PUBLIC - GUARANTEED NEVER TO 404!)
    // -------------------------------------------------------------
    if (subpath === '/warung' && method === 'GET') {
      const catalog = await getStoredCatalog();
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
      const catalog = await getStoredCatalog();
      const warung = (catalog.warungs || []).find((w) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }
      return createResponse(200, { warung });
    }

    // -------------------------------------------------------------
    // 4. CREATE WARUNG (ADMIN ONLY)
    // -------------------------------------------------------------
    if (subpath === '/warung' && method === 'POST') {
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const body = JSON.parse(event.body || '{}');
      const rawNama = String(body.nama || '').trim();
      if (!rawNama) {
        return createResponse(400, { error: 'Nama warung wajib diisi.' });
      }

      const catalog = await getStoredCatalog();
      const newWarung = {
        id: `warung-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
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
      await saveStoredCatalog(catalog);

      return createResponse(201, { success: true, warung: newWarung });
    }

    // -------------------------------------------------------------
    // 5. UPDATE WARUNG (ADMIN ONLY)
    // -------------------------------------------------------------
    const updateMatch = subpath.match(/^\/warung\/([^\/]+)$/);
    if (updateMatch && method === 'PUT') {
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = updateMatch[1];
      const catalog = await getStoredCatalog();
      const index = (catalog.warungs || []).findIndex((w) => w.id === warungId);
      if (index === -1) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      const target = catalog.warungs[index];
      const b = JSON.parse(event.body || '{}');

      if (b.nama !== undefined) target.nama = String(b.nama).trim().toUpperCase();
      if (b.alamat !== undefined) target.alamat = String(b.alamat).trim();
      if (b.maps_url !== undefined) target.maps_url = String(b.maps_url).trim();
      if (b.kategori !== undefined) target.kategori = String(b.kategori).trim();
      if (b.logo !== undefined) target.logo = String(b.logo).trim();

      const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'] as const;
      for (const day of days) {
        if (b[`${day}_buka`] !== undefined) (target as any)[`${day}_buka`] = String(b[`${day}_buka`]).trim();
        if (b[`${day}_tutup`] !== undefined) (target as any)[`${day}_tutup`] = String(b[`${day}_tutup`]).trim();
        if (b[`${day}_libur`] !== undefined) (target as any)[`${day}_libur`] = Boolean(b[`${day}_libur`]);
      }

      if (b.status !== undefined) target.status = b.status === 'tutup' ? 'tutup' : 'buka';
      if (b.is_active !== undefined) target.is_active = Boolean(b.is_active);
      target.updated_at = new Date().toISOString();

      catalog.warungs[index] = target;
      await saveStoredCatalog(catalog);

      return createResponse(200, { success: true, warung: target });
    }

    // -------------------------------------------------------------
    // 6. DELETE WARUNG (ADMIN ONLY)
    // -------------------------------------------------------------
    const deleteWarungMatch = subpath.match(/^\/warung\/([^\/]+)$/);
    if (deleteWarungMatch && method === 'DELETE') {
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = deleteWarungMatch[1];
      const catalog = await getStoredCatalog();
      const initialCount = catalog.warungs.length;
      catalog.warungs = catalog.warungs.filter((w) => w.id !== warungId);

      if (catalog.warungs.length === initialCount) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      await saveStoredCatalog(catalog);
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
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = uploadLogoMatch[1];
      const catalog = await getStoredCatalog();
      const warung = (catalog.warungs || []).find((w) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      let logoDataUrl = '';
      const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

      if (contentType.includes('application/json')) {
        const body = JSON.parse(event.body || '{}');
        logoDataUrl = body.logoDataUrl || body.logo || '';
      } else if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
        if (boundaryMatch) {
          const boundary = boundaryMatch[1].trim();
          const bodyBuffer = event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64')
            : Buffer.from(event.body || '', 'utf-8');
          const files = parseMultipartFiles(bodyBuffer, boundary);
          if (files.length > 0) {
            logoDataUrl = files[0].dataUrl;
          }
        }
      }

      if (!logoDataUrl) {
        return createResponse(400, { error: 'Data logo tidak ditemukan.' });
      }

      warung.logo = logoDataUrl;
      warung.updated_at = new Date().toISOString();
      await saveStoredCatalog(catalog);

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
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = deleteLogoMatch[1];
      const catalog = await getStoredCatalog();
      const warung = (catalog.warungs || []).find((w) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      warung.logo = '';
      warung.updated_at = new Date().toISOString();
      await saveStoredCatalog(catalog);

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
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = uploadPhotosMatch[1];
      const catalog = await getStoredCatalog();
      const warung = (catalog.warungs || []).find((w) => w.id === warungId);
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
      const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

      if (contentType.includes('application/json')) {
        const body = JSON.parse(event.body || '{}');
        if (Array.isArray(body.photos)) {
          incomingPhotos = body.photos.map((p: any) => ({
            dataUrl: p.dataUrl || p.file_url || p.url,
            fileName: p.fileName || p.file_name || 'menu_foto.jpg',
          }));
        } else if (body.dataUrl) {
          incomingPhotos = [{ dataUrl: body.dataUrl, fileName: body.fileName || 'menu_foto.jpg' }];
        }
      } else if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
        if (boundaryMatch) {
          const boundary = boundaryMatch[1].trim();
          const bodyBuffer = event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64')
            : Buffer.from(event.body || '', 'utf-8');
          const files = parseMultipartFiles(bodyBuffer, boundary);
          incomingPhotos = files.map((f) => ({
            dataUrl: f.dataUrl,
            fileName: f.filename,
          }));
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
      await saveStoredCatalog(catalog);

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
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = reorderMatch[1];
      const catalog = await getStoredCatalog();
      const warung = (catalog.warungs || []).find((w) => w.id === warungId);
      if (!warung) {
        return createResponse(404, { error: 'Warung tidak ditemukan.' });
      }

      const body = JSON.parse(event.body || '{}');
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
      await saveStoredCatalog(catalog);

      return createResponse(200, { success: true, warung });
    }

    // -------------------------------------------------------------
    // 11. DELETE SINGLE WARUNG PHOTO (ADMIN ONLY)
    // -------------------------------------------------------------
    const deletePhotoMatch = subpath.match(/^\/warung\/([^\/]+)\/photos\/([^\/]+)$/);
    if (deletePhotoMatch && method === 'DELETE') {
      if (!verifyAdminAuth(authHeader)) {
        return createResponse(401, { error: 'Akses ditolak: Autentikasi admin diperlukan.' });
      }

      const warungId = deletePhotoMatch[1];
      const photoId = deletePhotoMatch[2];

      const catalog = await getStoredCatalog();
      const warung = (catalog.warungs || []).find((w) => w.id === warungId);
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
      await saveStoredCatalog(catalog);

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
    console.error('[Netlify Function Error]', err);
    return createResponse(500, {
      error: 'Terjadi kesalahan pada server backend Netlify.',
      details: err?.message || String(err),
    });
  }
};
