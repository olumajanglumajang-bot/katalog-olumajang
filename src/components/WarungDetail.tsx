import React, { useState } from 'react';
import { Warung } from '../types';
import { PhotoLightbox } from './PhotoLightbox';
import { getTodaySchedule, DAY_KEYS, DAY_NAMES } from '../utils/schedule';
import { shareWarungToWhatsApp } from '../utils/share';
import {
  MapPin,
  Clock,
  MessageSquare,
  Images,
  ArrowLeft,
  Share2,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface WarungDetailProps {
  warung: Warung;
  onBack: () => void;
  onOrder: () => void;
}

export const WarungDetail: React.FC<WarungDetailProps> = ({ warung, onBack, onOrder }) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const photos = warung.daftar_foto || [];
  const todaySchedule = getTodaySchedule(warung);

  // Address logic
  const hasManualAddress = Boolean(warung.alamat && warung.alamat.trim());
  const hasMapsUrl = Boolean(warung.maps_url && warung.maps_url.trim());
  const hasAnyAddress = hasManualAddress || hasMapsUrl;

  // Check which days have schedules filled
  const validDailySchedules = DAY_KEYS.map((key) => {
    const isLibur = Boolean((warung as any)[`${key}_libur`]);
    const buka = (warung as any)[`${key}_buka`]?.trim() || '';
    const tutup = (warung as any)[`${key}_tutup`]?.trim() || '';
    if (!isLibur && !buka && !tutup) return null;
    return {
      dayKey: key,
      dayName: DAY_NAMES[key],
      isLibur,
      buka,
      tutup,
      text: isLibur ? 'LIBUR' : `${buka} – ${tutup} WIB`,
    };
  }).filter(Boolean);

  const handleShare = async () => {
    setShareLoading(true);
    setShareFeedback(null);
    try {
      const res = await shareWarungToWhatsApp(warung);
      if (res.message) {
        setShareFeedback(res.message);
        setTimeout(() => setShareFeedback(null), 5000);
      }
    } catch {
      setShareFeedback('Gagal membagikan katalog.');
      setTimeout(() => setShareFeedback(null), 3000);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Top sticky navigation bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-14 sm:top-16 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600" />
            <span>KEMBALI KE KATALOG</span>
          </button>

          {/* Share to WhatsApp Button */}
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 hover:bg-emerald-200 rounded-xl transition-all cursor-pointer border border-emerald-300 shadow-xs active:scale-95 disabled:opacity-60"
            title="Bagikan Warung Ini ke WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>{shareLoading ? 'Menyiapkan Gambar...' : '📤 BAGIKAN KE WHATSAPP'}</span>
          </button>
        </div>
      </div>

      {/* Share feedback toast */}
      {shareFeedback && (
        <div className="max-w-4xl mx-auto px-4 pt-3">
          <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs">
            <span>{shareFeedback}</span>
            <button
              onClick={() => setShareFeedback(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-4 sm:pt-6 space-y-5">
        {/* Warung Header Info Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Logo / Thumbnail */}
            {warung.logo ? (
              <img
                src={warung.logo}
                alt={warung.nama}
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-800 flex flex-col items-center justify-center border border-emerald-200 shrink-0">
                <Images className="w-8 h-8 opacity-70 mb-1" />
                <span className="text-[10px] font-black uppercase">OLUMAJANG</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Category & Status */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {warung.kategori && warung.kategori.trim() && (
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                    {warung.kategori}
                  </span>
                )}

                {todaySchedule && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase px-2 py-0.5 rounded-lg bg-slate-100">
                    {todaySchedule.isLibur ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-amber-700">HARI INI LIBUR</span>
                      </>
                    ) : todaySchedule.isOpen ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-700">BUKA SEKARANG</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span className="text-rose-600">SEDANG TUTUP</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* NAMA WARUNG (MANDATORY STRICT UPPERCASE) */}
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">
                {warung.nama}
              </h1>

              {/* Alamat (Only display if available! No empty placeholder) */}
              {hasAnyAddress && (
                <div className="mt-3 space-y-1.5">
                  {hasManualAddress && (
                    <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{warung.alamat}</span>
                    </div>
                  )}

                  {hasMapsUrl && (
                    <div className="pt-0.5">
                      <a
                        href={warung.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-xl transition-colors border border-blue-200"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>📍 LIHAT LOKASI DI GOOGLE MAPS</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Today's Schedule (Only display if available) */}
              {todaySchedule && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 mt-2.5">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    {todaySchedule.isLibur ? 'Hari ini: LIBUR' : `Hari ini: ${todaySchedule.displayText}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Full Week Operational Hours Section (if set) */}
          {validDailySchedules.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowFullSchedule(!showFullSchedule)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-emerald-700 py-1 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>JADWAL OPERASIONAL LENGKAP (SENIN – MINGGU)</span>
                </div>
                {showFullSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showFullSchedule && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                  {validDailySchedules.map((sched: any) => (
                    <div
                      key={sched.dayKey}
                      className="flex items-center justify-between py-1 px-2 rounded-lg bg-white border border-slate-100"
                    >
                      <span className="font-bold uppercase text-slate-800">{sched.dayName}</span>
                      <span
                        className={`font-semibold ${
                          sched.isLibur ? 'text-amber-600 font-bold' : 'text-slate-600'
                        }`}
                      >
                        {sched.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Row inside Card */}
          <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>BAGIKAN KE WHATSAPP</span>
            </button>

            <button
              onClick={onOrder}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 fill-white/20" />
              <span>💬 PESAN VIA WHATSAPP</span>
            </button>
          </div>
        </div>

        {/* Section: Galeri Foto Menu */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                <Images className="w-5 h-5 text-emerald-600" />
                <span>GALERI FOTO MENU</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ketuk foto untuk memperbesar, pinch zoom dua jari, dan geser detail menu
              </p>
            </div>

            {/* Counter: e.g. "37/50 FOTO" */}
            <div className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs">
              <span className="text-emerald-700">{photos.length}</span>
              <span className="text-slate-400 font-normal"> / 50 FOTO</span>
            </div>
          </div>

          {/* Photo Grid */}
          {photos.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
              <Images className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">FOTO MENU BELUM TERSEDIA</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Admin sedang menyiapkan galeri foto menu untuk warung ini. Anda dapat langsung memesan via WhatsApp.
              </p>
              <button
                onClick={onOrder}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Pesan Langsung via WA</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {photos.map((foto, index) => {
                const url = foto.file_url || (foto as any).url;
                return (
                  <div
                    key={foto.id}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-md transition-all aspect-square cursor-pointer active:scale-95"
                  >
                    <img
                      src={url}
                      alt={`Foto Menu ${index + 1}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <span className="px-2.5 py-1 bg-black/60 backdrop-blur-xs rounded-xl text-xs font-bold">
                        Buka Foto
                      </span>
                    </div>

                    {/* Photo index badge */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-xs rounded-md text-[10px] font-bold text-white">
                      #{index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom WhatsApp Floating CTA on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg z-30 pb-safe">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="hidden sm:block text-xs text-slate-600 min-w-0">
            <p className="font-extrabold text-slate-800 uppercase truncate">{warung.nama}</p>
            <p className="text-[11px] text-slate-500">Pusat WA: 081334274818</p>
          </div>

          <button
            onClick={onOrder}
            className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 fill-white/20" />
            <span>💬 PESAN VIA WHATSAPP</span>
          </button>
        </div>
      </div>

      {/* Lightbox Component */}
      {selectedPhotoIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={selectedPhotoIndex}
          isOpen={selectedPhotoIndex !== null}
          onClose={() => setSelectedPhotoIndex(null)}
          onNavigate={(index) => setSelectedPhotoIndex(index)}
        />
      )}
    </div>
  );
};
