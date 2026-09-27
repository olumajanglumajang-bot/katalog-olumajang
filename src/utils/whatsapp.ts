/**
 * WhatsApp Order Dispatcher
 *
 * Sesuai spesifikasi:
 * 1. Deep link utama: whatsapp://send?phone=6281334274818&text=...
 * 2. Fallback HTTPS: https://wa.me/6281334274818?text=...
 * 3. Seluruh isi pesan di-encode dengan encodeURIComponent()
 * 4. window.location.href = whatsappDeepLink;
 * 5. Kompatibel dengan Android Chrome, Web production, Capacitor APK, dan preview iframe
 * 6. Tidak menggunakan window.open()
 */

declare global {
  interface Window {
    Capacitor?: any;
  }
}

export const CENTRAL_PHONE = '6281334274818';

export interface WhatsAppOrderPayload {
  namaPemesan: string;
  namaWarung: string;
  alamatJemput?: string;
  alamatTujuan?: string;
  pesanan: string;
  pembayaran?: string;
  catatan?: string;
}

/**
 * Membentuk template pesan pesanan persis sesuai format yang ditentukan:
 *
 * ORDER KATALOG OLUMAJANG
 *
 * Nama Pemesan: [nama]
 *
 * Warung: [nama warung]
 *
 * Alamat Jemput:
 * [alamat jemput]
 *
 * Alamat Tujuan:
 * [alamat tujuan]
 *
 * Pesanan:
 * [pesanan]
 *
 * Pembayaran:
 * [pembayaran]
 *
 * Catatan:
 * [catatan]
 */
export function formatOrderMessage(payload: WhatsAppOrderPayload): string {
  const namaPemesan = payload.namaPemesan.trim();
  const namaWarung = payload.namaWarung.trim().toUpperCase();
  const alamatJemput = payload.alamatJemput && payload.alamatJemput.trim() ? payload.alamatJemput.trim() : '-';
  const alamatTujuan = payload.alamatTujuan && payload.alamatTujuan.trim() ? payload.alamatTujuan.trim() : '-';
  const pesanan = payload.pesanan.trim();
  const pembayaran = payload.pembayaran && payload.pembayaran.trim() ? payload.pembayaran.trim() : 'Tunai';
  const catatan = payload.catatan && payload.catatan.trim() ? payload.catatan.trim() : '-';

  return `ORDER KATALOG OLUMAJANG

Nama Pemesan: ${namaPemesan}

Warung: ${namaWarung}

Alamat Jemput:
${alamatJemput}

Alamat Tujuan:
${alamatTujuan}

Pesanan:
${pesanan}

Pembayaran:
${pembayaran}

Catatan:
${catatan}`;
}

/**
 * Mengembalikan objek URL WhatsApp (Deep link dan Web fallback)
 */
export function getWhatsAppUrls(payload: WhatsAppOrderPayload): {
  deepLink: string;
  fallbackUrl: string;
  encodedMessage: string;
} {
  const message = formatOrderMessage(payload);
  const encodedMessage = encodeURIComponent(message);

  return {
    deepLink: `whatsapp://send?phone=${CENTRAL_PHONE}&text=${encodedMessage}`,
    fallbackUrl: `https://wa.me/${CENTRAL_PHONE}?text=${encodedMessage}`,
    encodedMessage,
  };
}

/**
 * Mengirim order ke WhatsApp:
 * 1. Menjalankan deep link whatsapp://send?phone=...
 * 2. Menyediakan fallback otomatis ke https://wa.me/... jika deep link tidak merespons
 * 3. Menggunakan window.location.href tanpa window.open()
 */
export async function sendOrderToWhatsApp(payload: WhatsAppOrderPayload): Promise<{ success: boolean; fallbackUrl: string }> {
  const { deepLink, fallbackUrl } = getWhatsAppUrls(payload);

  console.log('[WhatsApp Order] Memulai pengiriman pesanan ke WhatsApp:', {
    warung: payload.namaWarung,
    nomorTujuan: CENTRAL_PHONE,
  });

  // 1. Jika berjalan di Capacitor Android APK native
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    try {
      const plugins = window.Capacitor.Plugins;
      if (plugins?.AppLauncher) {
        const canOpen = await plugins.AppLauncher.canOpenUrl({ url: deepLink });
        if (canOpen?.value) {
          await plugins.AppLauncher.openUrl({ url: deepLink });
          return { success: true, fallbackUrl };
        }
      }
      if (plugins?.Browser) {
        await plugins.Browser.open({ url: fallbackUrl });
        return { success: true, fallbackUrl };
      }
    } catch (err) {
      console.warn('[WhatsApp Order] Capacitor native dispatch exception:', err);
    }
  }

  // 2. Lingkungan Android Chrome / Mobile Browser / Web Production
  // Prioritaskan deep link whatsapp:// via window.location.href
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const isMobile = isAndroid || isIOS;

  if (isMobile) {
    // Pada mobile device, coba jalankan deep link langsung via window.location.href
    try {
      window.location.href = deepLink;
    } catch (e) {
      console.warn('[WhatsApp Order] window.location.href deepLink gagal:', e);
      window.location.href = fallbackUrl;
    }

    // Set timeout fallback ke https://wa.me jika aplikasi whatsapp tidak terbuka
    setTimeout(() => {
      // Jika dokumen masih aktif/fokus (berarti WhatsApp app tidak mengambil alih layar)
      if (document.visibilityState === 'visible') {
        console.log('[WhatsApp Order] Deep link tidak membuka app, mengalihkan ke wa.me fallback');
        window.location.href = fallbackUrl;
      }
    }, 1800);

    return { success: true, fallbackUrl };
  }

  // 3. Fallback Web Browser Desktop / Non-mobile: Langsung gunakan https://wa.me
  try {
    window.location.href = fallbackUrl;
  } catch (err) {
    console.error('[WhatsApp Order] Gagal mengarahkan window.location.href:', err);
  }

  return { success: true, fallbackUrl };
}
