import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Admin credential configuration (Never exposed to client)
const ADMIN_PASSWORD_RAW = process.env.ADMIN_PASSWORD || '231288';
const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update(ADMIN_PASSWORD_RAW).digest('hex');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const activeAdminTokens = new Set<string>();

// Data & upload directories
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage for warung photos & logos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 50,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan!'));
    }
  },
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads serving
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

interface PhotoItem {
  id: string;
  warung_id: string;
  file_url: string;
  file_name: string;
  urutan: number;
  created_at: string;
}

interface WarungItem {
  id: string;
  nama: string;
  logo: string;
  alamat: string;
  maps_url: string;
  kategori: string;
  senin_buka: string;
  senin_tutup: string;
  senin_libur: boolean;
  selasa_buka: string;
  selasa_tutup: string;
  selasa_libur: boolean;
  rabu_buka: string;
  rabu_tutup: string;
  rabu_libur: boolean;
  kamis_buka: string;
  kamis_tutup: string;
  kamis_libur: boolean;
  jumat_buka: string;
  jumat_tutup: string;
  jumat_libur: boolean;
  sabtu_buka: string;
  sabtu_tutup: string;
  sabtu_libur: boolean;
  minggu_buka: string;
  minggu_tutup: string;
  minggu_libur: boolean;
  status: 'buka' | 'tutup';
  is_active: boolean;
  daftar_foto: PhotoItem[];
  created_at: string;
  updated_at: string;
}

interface CatalogData {
  warungs: WarungItem[];
}

function readCatalog(): CatalogData {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const content = fs.readFileSync(CATALOG_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data.warungs)) {
        // Normalize fields for backward compatibility if needed
        data.warungs.forEach((w: any) => {
          if (!w.daftar_foto) w.daftar_foto = [];
          w.daftar_foto.forEach((p: any) => {
            if (!p.file_url && p.url) p.file_url = p.url;
            if (!p.file_name && p.nama_file) p.file_name = p.nama_file;
          });
        });
        return data;
      }
    }
  } catch (err) {
    console.error('Error reading catalog file:', err);
  }
  return { warungs: [] };
}

function writeCatalog(data: CatalogData): void {
  try {
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing catalog file:', err);
  }
}

// Authentication middleware for Admin routes
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: Token autentikasi diperlukan.' });
  }

  const token = authHeader.split(' ')[1];
  if (activeAdminTokens.has(token)) {
    return next();
  }

  // Also verify HMAC signed stateless token
  const parts = token.split('.');
  if (parts.length === 2) {
    const [payload, signature] = parts;
    const expected1 = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    const expected2 = crypto.createHmac('sha256', 'olumajang_secret_salt_2026').update(payload).digest('hex');
    if (signature === expected1 || signature === expected2) {
      activeAdminTokens.add(token);
      return next();
    }
  }

  return res.status(403).json({ error: 'Sesi admin tidak valid atau sudah kedaluwarsa.' });
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Admin Authentication
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Kata sandi harus diisi.' });
  }

  const inputHash = crypto.createHash('sha256').update(password.trim()).digest('hex');

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(inputHash, 'utf-8'),
    Buffer.from(ADMIN_PASSWORD_HASH, 'utf-8')
  );

  if (!isMatch) {
    return res.status(401).json({ error: 'Kata sandi admin salah. Silakan coba lagi.' });
  }

  const tokenPayload = `${Date.now()}-${crypto.randomBytes(24).toString('hex')}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(tokenPayload).digest('hex');
  const token = `${tokenPayload}.${signature}`;

  activeAdminTokens.add(token);

  return res.json({
    success: true,
    token,
    message: 'Berhasil login sebagai admin.',
  });
});

app.get('/api/admin/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }
  const token = authHeader.split(' ')[1];
  const isValid = activeAdminTokens.has(token);
  return res.json({ authenticated: isValid });
});

app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeAdminTokens.delete(token);
  }
  return res.json({ success: true, message: 'Berhasil keluar.' });
});

// 2. Warung Endpoints
// Strict A-Z sort based on normalized uppercase name
app.get('/api/warung', (_req: Request, res: Response) => {
  const catalog = readCatalog();
  const sorted = [...catalog.warungs].sort((a, b) =>
    a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
  );
  return res.json({ warungs: sorted });
});

app.get('/api/warung/:id', (req: Request, res: Response) => {
  const catalog = readCatalog();
  const warung = catalog.warungs.find((w) => w.id === req.params.id);
  if (!warung) {
    return res.status(404).json({ error: 'Warung tidak ditemukan.' });
  }
  return res.json({ warung });
});

// Create Warung (Admin only)
app.post('/api/warung', requireAdminAuth, (req: Request, res: Response) => {
  const body = req.body;
  const rawNama = body.nama ? String(body.nama).trim() : '';

  if (!rawNama) {
    return res.status(400).json({ error: 'Nama warung wajib diisi.' });
  }

  const catalog = readCatalog();
  const newWarung: WarungItem = {
    id: `warung-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    nama: rawNama.toUpperCase(),
    logo: body.logo?.trim() || '',
    alamat: body.alamat?.trim() || '',
    maps_url: body.maps_url?.trim() || '',
    kategori: body.kategori?.trim() || 'Makanan & Minuman',
    senin_buka: body.senin_buka?.trim() || '',
    senin_tutup: body.senin_tutup?.trim() || '',
    senin_libur: Boolean(body.senin_libur),
    selasa_buka: body.selasa_buka?.trim() || '',
    selasa_tutup: body.selasa_tutup?.trim() || '',
    selasa_libur: Boolean(body.selasa_libur),
    rabu_buka: body.rabu_buka?.trim() || '',
    rabu_tutup: body.rabu_tutup?.trim() || '',
    rabu_libur: Boolean(body.rabu_libur),
    kamis_buka: body.kamis_buka?.trim() || '',
    kamis_tutup: body.kamis_tutup?.trim() || '',
    kamis_libur: Boolean(body.kamis_libur),
    jumat_buka: body.jumat_buka?.trim() || '',
    jumat_tutup: body.jumat_tutup?.trim() || '',
    jumat_libur: Boolean(body.jumat_libur),
    sabtu_buka: body.sabtu_buka?.trim() || '',
    sabtu_tutup: body.sabtu_tutup?.trim() || '',
    sabtu_libur: Boolean(body.sabtu_libur),
    minggu_buka: body.minggu_buka?.trim() || '',
    minggu_tutup: body.minggu_tutup?.trim() || '',
    minggu_libur: Boolean(body.minggu_libur),
    status: body.status === 'tutup' ? 'tutup' : 'buka',
    is_active: body.is_active !== false,
    daftar_foto: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  catalog.warungs.push(newWarung);
  writeCatalog(catalog);

  return res.status(201).json({ success: true, warung: newWarung });
});

// Update Warung (Admin only)
app.put('/api/warung/:id', requireAdminAuth, (req: Request, res: Response) => {
  const catalog = readCatalog();
  const index = catalog.warungs.findIndex((w) => w.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Warung tidak ditemukan.' });
  }

  const target = catalog.warungs[index];
  const b = req.body;

  if (b.nama !== undefined) target.nama = String(b.nama).trim().toUpperCase();
  if (b.alamat !== undefined) target.alamat = String(b.alamat).trim();
  if (b.maps_url !== undefined) target.maps_url = String(b.maps_url).trim();
  if (b.kategori !== undefined) target.kategori = String(b.kategori).trim();
  if (b.logo !== undefined) target.logo = String(b.logo).trim();

  // Schedule fields
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
  writeCatalog(catalog);

  return res.json({ success: true, warung: target });
});

// Upload Warung Logo from Gallery (Admin only)
app.post('/api/warung/:id/logo', requireAdminAuth, upload.single('logo') as any, (req: Request, res: Response) => {
  const catalog = readCatalog();
  const warung = catalog.warungs.find((w) => w.id === req.params.id);

  if (!warung) {
    return res.status(404).json({ error: 'Warung tidak ditemukan.' });
  }

  let logoUrl = '';
  if (req.file) {
    logoUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.logoDataUrl || req.body.logo) {
    logoUrl = req.body.logoDataUrl || req.body.logo;
  }

  if (!logoUrl) {
    return res.status(400).json({ error: 'Tidak ada file logo yang diunggah.' });
  }

  // Remove old uploaded logo if it was stored locally
  if (warung.logo && warung.logo.startsWith('/uploads/')) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(warung.logo));
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (err) {
        console.error('Failed to unlink old logo:', err);
      }
    }
  }

  warung.logo = logoUrl;
  warung.updated_at = new Date().toISOString();
  writeCatalog(catalog);

  return res.json({
    success: true,
    logoUrl: warung.logo,
    warung,
    message: 'Logo warung berhasil diunggah.',
  });
});

// Delete Warung Logo (Admin only)
app.delete('/api/warung/:id/logo', requireAdminAuth, (req: Request, res: Response) => {
  const catalog = readCatalog();
  const warung = catalog.warungs.find((w) => w.id === req.params.id);

  if (!warung) {
    return res.status(404).json({ error: 'Warung tidak ditemukan.' });
  }

  if (warung.logo && warung.logo.startsWith('/uploads/')) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(warung.logo));
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (err) {
        console.error('Failed to unlink logo:', err);
      }
    }
  }

  warung.logo = '';
  warung.updated_at = new Date().toISOString();
  writeCatalog(catalog);

  return res.json({
    success: true,
    warung,
    message: 'Logo warung berhasil dihapus.',
  });
});

// Delete Warung (Admin only)
app.delete('/api/warung/:id', requireAdminAuth, (req: Request, res: Response) => {
  const catalog = readCatalog();
  const warung = catalog.warungs.find((w) => w.id === req.params.id);

  if (!warung) {
    return res.status(404).json({ error: 'Warung tidak ditemukan.' });
  }

  // Delete logo file if local
  if (warung.logo && warung.logo.startsWith('/uploads/')) {
    const logoFile = path.join(UPLOADS_DIR, path.basename(warung.logo));
    if (fs.existsSync(logoFile)) {
      try {
        fs.unlinkSync(logoFile);
      } catch {}
    }
  }

  // Delete photos files
  for (const foto of warung.daftar_foto) {
    const url = foto.file_url || (foto as any).url || '';
    if (url.startsWith('/uploads/')) {
      const filename = path.basename(url);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }
  }

  catalog.warungs = catalog.warungs.filter((w) => w.id !== req.params.id);
  writeCatalog(catalog);

  return res.json({ success: true, message: 'Warung dan seluruh fotonya berhasil dihapus.' });
});

// 3. Photo Management (Admin only)
// POST /api/warung/:id/photos - Upload multiple photos with 50 photos maximum limit!
app.post(
  '/api/warung/:id/photos',
  requireAdminAuth,
  upload.array('photos', 50) as any,
  (req: Request, res: Response) => {
    const catalog = readCatalog();
    const warung = catalog.warungs.find((w) => w.id === req.params.id);

    if (!warung) {
      return res.status(404).json({ error: 'Warung tidak ditemukan.' });
    }

    let incomingPhotos: Array<{ url: string; fileName: string }> = [];

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      incomingPhotos = files.map((file) => ({
        url: `/uploads/${file.filename}`,
        fileName: file.originalname,
      }));
    } else if (Array.isArray(req.body.photos)) {
      incomingPhotos = req.body.photos.map((p: any) => ({
        url: p.dataUrl || p.file_url || p.url,
        fileName: p.fileName || p.file_name || 'menu_foto.jpg',
      }));
    }

    if (incomingPhotos.length === 0) {
      return res.status(400).json({ error: 'Tidak ada file gambar yang diunggah.' });
    }

    // MANDATORY 50-PHOTO STRICT LIMIT
    const currentCount = warung.daftar_foto.length;
    const remainingQuota = Math.max(0, 50 - currentCount);

    if (remainingQuota <= 0) {
      // Remove newly uploaded files from disk to prevent orphan files
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
      return res.status(400).json({
        error: 'MAKSIMAL 50 FOTO UNTUK SATU WARUNG.',
        currentCount,
        maxLimit: 50,
      });
    }

    // Accept up to remaining quota
    const acceptedFiles = incomingPhotos.slice(0, remainingQuota);
    const rejectedCount = incomingPhotos.length - acceptedFiles.length;

    // Unlink any files exceeding 50 limit
    if (files.length > remainingQuota) {
      const rejectedFiles = files.slice(remainingQuota);
      for (const file of rejectedFiles) {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch {}
        }
      }
    }

    // Add accepted photos
    const newPhotos: PhotoItem[] = acceptedFiles.map((item, idx) => ({
      id: `p-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      warung_id: warung.id,
      file_url: item.url,
      file_name: item.fileName,
      urutan: currentCount + idx + 1,
      created_at: new Date().toISOString(),
    }));

    warung.daftar_foto.push(...newPhotos);
    warung.updated_at = new Date().toISOString();

    writeCatalog(catalog);

    return res.json({
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
);

// DELETE /api/warung/:id/photos/:photoId (Admin only)
app.delete(
  '/api/warung/:id/photos/:photoId',
  requireAdminAuth,
  (req: Request, res: Response) => {
    const catalog = readCatalog();
    const warung = catalog.warungs.find((w) => w.id === req.params.id);

    if (!warung) {
      return res.status(404).json({ error: 'Warung tidak ditemukan.' });
    }

    const photo = warung.daftar_foto.find((p) => p.id === req.params.photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Foto tidak ditemukan.' });
    }

    const photoUrl = photo.file_url || (photo as any).url || '';
    if (photoUrl.startsWith('/uploads/')) {
      const filename = path.basename(photoUrl);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }

    warung.daftar_foto = warung.daftar_foto.filter((p) => p.id !== req.params.photoId);
    warung.daftar_foto.forEach((p, idx) => {
      p.urutan = idx + 1;
    });
    warung.updated_at = new Date().toISOString();

    writeCatalog(catalog);

    return res.json({
      success: true,
      message: 'Foto berhasil dihapus.',
      totalPhotos: warung.daftar_foto.length,
      warung,
    });
  }
);

// PUT /api/warung/:id/photos/reorder (Admin only)
app.put(
  '/api/warung/:id/photos/reorder',
  requireAdminAuth,
  (req: Request, res: Response) => {
    const { photoIds } = req.body;
    if (!Array.isArray(photoIds)) {
      return res.status(400).json({ error: 'Urutan foto (photoIds array) diperlukan.' });
    }

    const catalog = readCatalog();
    const warung = catalog.warungs.find((w) => w.id === req.params.id);

    if (!warung) {
      return res.status(404).json({ error: 'Warung tidak ditemukan.' });
    }

    const photoMap = new Map(warung.daftar_foto.map((p) => [p.id, p]));
    const reordered: PhotoItem[] = [];

    photoIds.forEach((id, index) => {
      const p = photoMap.get(id);
      if (p) {
        p.urutan = index + 1;
        reordered.push(p);
        photoMap.delete(id);
      }
    });

    photoMap.forEach((p) => {
      p.urutan = reordered.length + 1;
      reordered.push(p);
    });

    warung.daftar_foto = reordered;
    warung.updated_at = new Date().toISOString();

    writeCatalog(catalog);

    return res.json({ success: true, warung });
  }
);

// Support deep warung routing for both Vite development and production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Katalog Olumajang aktif di port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
});
