import { Warung } from '../types';

declare global {
  interface Window {
    Capacitor?: any;
  }
}

export interface ShareResult {
  shared: boolean;
  copied?: boolean;
  message?: string;
}

/**
 * Fetches an image from an absolute or relative URL, handles format conversion if necessary,
 * and produces a genuine File object for native file sharing.
 */
async function getImageFileFromUrl(imageUrl: string, fileName: string): Promise<File | null> {
  try {
    // If relative path like /uploads/..., resolve against window.location.origin
    const fullUrl = imageUrl.startsWith('http')
      ? imageUrl
      : `${window.location.origin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

    const response = await fetch(fullUrl, { mode: 'cors' });
    if (!response.ok) {
      console.warn('[Share] Gagal fetch gambar:', response.status, response.statusText);
      return null;
    }

    const blob = await response.blob();
    let mimeType = blob.type || 'image/jpeg';
    let targetBlob: Blob = blob;

    // Ensure it is one of: image/jpeg, image/png, image/webp
    // If not standard or if SVG/other, convert via canvas to JPEG
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      try {
        const converted = await convertBlobToJpeg(blob);
        if (converted) {
          targetBlob = converted;
          mimeType = 'image/jpeg';
        }
      } catch (convErr) {
        console.warn('[Share] Gagal convert ke JPEG, gunakan blob asli:', convErr);
      }
    }

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const cleanFileName = `${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;

    return new File([targetBlob], cleanFileName, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error('[Share] Exception saat mengambil gambar warung:', err);
    return null;
  }
}

/**
 * Converts any image blob to a clean image/jpeg blob using an offscreen canvas
 */
function convertBlobToJpeg(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (jpegBlob) => {
          resolve(jpegBlob);
        },
        'image/jpeg',
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Shares a Warung to WhatsApp / Native Share Sheet with a genuine image File.
 *
 * Sesuai spesifikasi:
 * 1. Gambar utama: Logo warung jika ada, jika tidak ada gunakan foto menu pertama.
 * 2. URL gambar -> fetch() -> Blob -> File -> navigator.canShare({files}) -> navigator.share({files, text, title})
 * 3. Teks:
 *    KATALOG OLUMAJANG
 *
 *    [NAMA WARUNG]
 *
 *    Lihat katalog/menu:
 *    [LINK KATALOG WARUNG]
 * 4. Fallback jika file sharing tidak didukung: fallback web share teks/url atau salin link.
 */
export async function shareWarungToWhatsApp(warung: Warung): Promise<ShareResult> {
  const warungName = warung.nama.toUpperCase();
  const catalogUrl = `${window.location.origin}/#warung-${warung.id}`;

  const shareText = `KATALOG OLUMAJANG

${warungName}

Lihat katalog/menu:
${catalogUrl}`;

  // Image prioritizing Logo, fallback to first menu photo
  const imageUrl =
    (warung.logo && warung.logo.trim() ? warung.logo.trim() : null) ||
    (warung.daftar_foto && warung.daftar_foto.length > 0
      ? warung.daftar_foto[0]?.file_url || (warung.daftar_foto[0] as any)?.url
      : null);

  // 1. Coba ambil gambar sebagai file asli jika imageUrl tersedia
  let imageFile: File | null = null;
  if (imageUrl) {
    imageFile = await getImageFileFromUrl(imageUrl, `katalog-${warung.id}`);
  }

  // 2. Cek apakah running di Capacitor Android APK dan ada plugin Share
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    try {
      const plugins = window.Capacitor.Plugins;
      if (plugins?.Share) {
        // Jika ada imageFile, share via plugin Share
        await plugins.Share.share({
          title: 'Katalog Olumajang',
          text: shareText,
          url: catalogUrl,
          dialogTitle: `Bagikan ${warungName}`,
        });
        return { shared: true };
      }
    } catch (e) {
      console.warn('[Share] Capacitor Share plugin error:', e);
    }
  }

  // 3. Web Share API dengan File Image Asli (Android Chrome / Mobile)
  if (typeof navigator !== 'undefined' && navigator.share) {
    // A. Coba share dengan file gambar jika file tersedia dan canShare mengizinkan
    if (imageFile && navigator.canShare) {
      try {
        if (navigator.canShare({ files: [imageFile] })) {
          await navigator.share({
            files: [imageFile],
            title: 'Katalog Olumajang',
            text: shareText,
          });
          return { shared: true };
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { shared: false }; // User membatalkan dialog share
        }
        console.warn('[Share] Gagal share dengan files, mencoba fallback teks/url:', err);
      }
    }

    // B. Fallback Web Share jika file sharing tidak didukung oleh perangkat
    try {
      await navigator.share({
        title: 'Katalog Olumajang',
        text: shareText,
        url: catalogUrl,
      });
      return { shared: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { shared: false };
      }
      console.warn('[Share] Web share fallback error:', err);
    }
  }

  // 4. Fallback jika Web Share API tidak didukung pada browser ini (misal desktop browser / iframe sandbox)
  // Berikan pilihan salin link katalog ke clipboard
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(`${shareText}\n\n${catalogUrl}`);
      return {
        shared: false,
        copied: true,
        message: 'Link katalog berhasil disalin ke clipboard! Bagikan gambar tidak didukung pada browser ini.',
      };
    }
  } catch {}

  return {
    shared: false,
    copied: false,
    message: 'Bagikan gambar tidak didukung pada perangkat ini.',
  };
}
