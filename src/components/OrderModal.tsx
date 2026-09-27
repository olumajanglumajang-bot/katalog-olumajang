import React, { useState } from 'react';
import { Warung, OrderFormData } from '../types';
import { sendOrderToWhatsApp, getWhatsAppUrls, CENTRAL_PHONE } from '../utils/whatsapp';
import {
  X,
  Send,
  AlertCircle,
  Store,
  User,
  MapPin,
  Navigation,
  FileText,
  CreditCard,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

interface OrderModalProps {
  warung: Warung;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({ warung, isOpen, onClose }) => {
  // Seluruh field customer dimulai dalam keadaan KOSONG
  const [formData, setFormData] = useState<OrderFormData>({
    namaPemesan: '',
    namaWarung: warung.nama.toUpperCase(),
    alamatJemput: '',
    alamatTujuan: '',
    pesanan: '',
    metodePembayaran: 'Tunai',
    catatanTambahan: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrderFormData, string>>>({});
  const [generalError, setGeneralError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeFallbackUrl, setActiveFallbackUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  // Validasi:
  // 1. Nama Pemesan WAJIB
  // 2. Pesanan WAJIB
  // 3. Field lainnya (alamat jemput, alamat tujuan, pembayaran, catatan) boleh kosong
  // Jika validasi gagal, tampilkan pesan:
  // "Silakan lengkapi Nama Pemesan dan Pesanan."
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof OrderFormData, string>> = {};

    if (!formData.namaPemesan.trim()) {
      newErrors.namaPemesan = 'Nama Pemesan wajib diisi.';
    }
    if (!formData.pesanan.trim()) {
      newErrors.pesanan = 'Pesanan wajib diisi.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setGeneralError('Silakan lengkapi Nama Pemesan dan Pesanan.');
      return false;
    }

    setGeneralError('');
    return true;
  };

  const handleKirimWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const payload = {
      namaPemesan: formData.namaPemesan,
      namaWarung: warung.nama.toUpperCase(),
      alamatJemput: formData.alamatJemput,
      alamatTujuan: formData.alamatTujuan,
      pesanan: formData.pesanan,
      pembayaran: formData.metodePembayaran,
      catatan: formData.catatanTambahan,
    };

    try {
      const result = await sendOrderToWhatsApp(payload);
      setActiveFallbackUrl(result.fallbackUrl);
    } catch (err) {
      console.error('[OrderModal] Error saat dispatch WhatsApp:', err);
      const urls = getWhatsAppUrls(payload);
      setActiveFallbackUrl(urls.fallbackUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualFallbackClick = () => {
    if (!activeFallbackUrl) {
      const urls = getWhatsAppUrls({
        namaPemesan: formData.namaPemesan || 'Pelanggan',
        namaWarung: warung.nama.toUpperCase(),
        alamatJemput: formData.alamatJemput,
        alamatTujuan: formData.alamatTujuan,
        pesanan: formData.pesanan || '-',
        pembayaran: formData.metodePembayaran,
        catatan: formData.catatanTambahan,
      });
      window.location.href = urls.fallbackUrl;
    } else {
      window.location.href = activeFallbackUrl;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-white ml-0.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Formulir Pemesanan
              </h2>
              <p className="text-xs text-emerald-100 font-semibold truncate uppercase">
                {warung.nama}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup Form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleKirimWhatsApp} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {generalError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Section: Nama Warung (Otomatis dari katalog yang sedang dibuka, UPPERCASE) */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl">
            <label className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5 mb-1 tracking-wider uppercase">
              <Store className="w-3.5 h-3.5 text-emerald-600" />
              <span>Nama Warung (Otomatis)</span>
            </label>
            <input
              type="text"
              readOnly
              value={formData.namaWarung}
              className="w-full font-extrabold text-emerald-950 bg-transparent border-0 p-0 text-sm focus:ring-0 cursor-default uppercase"
            />
          </div>

          {/* Section: Data Pemesan */}
          <div className="space-y-3">
            {/* 1. Nama Pemesan (WAJIB) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Nama Pemesan <span className="text-rose-500 font-bold">*</span></span>
              </label>
              <input
                type="text"
                placeholder="Masukkan nama Anda..."
                value={formData.namaPemesan}
                onChange={(e) => {
                  setFormData({ ...formData, namaPemesan: e.target.value });
                  if (errors.namaPemesan) {
                    setErrors({ ...errors, namaPemesan: undefined });
                    setGeneralError('');
                  }
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                  errors.namaPemesan ? 'border-rose-400 focus:ring-rose-200 bg-rose-50/30' : 'border-slate-300 focus:ring-emerald-200'
                } rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:bg-white`}
              />
              {errors.namaPemesan && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.namaPemesan}</p>
              )}
            </div>

            {/* 2. Pesanan / Catatan Menu (WAJIB) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Pesanan / Catatan Menu <span className="text-rose-500 font-bold">*</span></span>
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan menu yang dipilih dari foto menu.&#10;Contoh: 2 Nasi Rawon Daging + 1 Es Teh Manis (pedas)"
                value={formData.pesanan}
                onChange={(e) => {
                  setFormData({ ...formData, pesanan: e.target.value });
                  if (errors.pesanan) {
                    setErrors({ ...errors, pesanan: undefined });
                    setGeneralError('');
                  }
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                  errors.pesanan ? 'border-rose-400 focus:ring-rose-200 bg-rose-50/30' : 'border-slate-300 focus:ring-emerald-200'
                } rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:bg-white`}
              />
              {errors.pesanan && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.pesanan}</p>
              )}
            </div>

            {/* 3. Alamat Jemput (Opsional) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Alamat Jemput / Pengambilan <span className="text-slate-400 font-normal">(Opsional)</span></span>
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Warung Bu Siti / Jl. Panglima Sudirman No. 45"
                value={formData.alamatJemput}
                onChange={(e) => setFormData({ ...formData, alamatJemput: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:ring-emerald-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:bg-white"
              />
            </div>

            {/* 4. Alamat Tujuan (Opsional) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-slate-500" />
                <span>Alamat Tujuan / Pengantaran <span className="text-slate-400 font-normal">(Opsional)</span></span>
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Jl. Hayam Wuruk No. 20, RT 01 RW 04, Lumajang (patokan depan masjid)"
                value={formData.alamatTujuan}
                onChange={(e) => setFormData({ ...formData, alamatTujuan: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:ring-emerald-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:bg-white"
              />
            </div>

            {/* 5. Metode Pembayaran (Opsional) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>Metode Pembayaran <span className="text-slate-400 font-normal">(Opsional)</span></span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, metodePembayaran: 'Tunai' })}
                  className={`py-2.5 px-4 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                    formData.metodePembayaran === 'Tunai'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  💵 Tunai (COD)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, metodePembayaran: 'Transfer' })}
                  className={`py-2.5 px-4 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                    formData.metodePembayaran === 'Transfer'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  💳 Transfer / QRIS
                </button>
              </div>
            </div>

            {/* 6. Catatan Tambahan (Opsional) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Catatan Tambahan <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Titip di pagar atau hubungi saat sampai"
                value={formData.catatanTambahan}
                onChange={(e) => setFormData({ ...formData, catatanTambahan: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:bg-white"
              />
            </div>
          </div>

          {/* Central WhatsApp Info Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-start gap-2">
            <span className="text-blue-600 font-bold shrink-0">ℹ️</span>
            <span>
              Pemesanan dikirim langsung ke WhatsApp Pusat Olumajang: <strong>081334274818</strong>
            </span>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 space-y-2">
            {/* Tombol Utama: KIRIM ORDER VIA WHATSAPP (whatsapp:// deep link + location.href) */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 active:scale-[0.99]"
            >
              <Send className="w-4 h-4 fill-white/20" />
              <span>{isSubmitting ? 'Membuka WhatsApp...' : 'KIRIM ORDER VIA WHATSAPP'}</span>
            </button>

            {/* Tombol Alternatif: BUKA WHATSAPP (Fallback langsung ke HTTPS wa.me jika deep link terhalang iframe sandbox) */}
            <button
              type="button"
              onClick={handleManualFallbackClick}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300"
              title="Gunakan jika aplikasi WhatsApp belum terbuka otomatis"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>BUKA WHATSAPP (Alternatif / Browser Web)</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
