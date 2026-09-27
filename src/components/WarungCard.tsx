import React from 'react';
import { Warung } from '../types';
import { getTodaySchedule } from '../utils/schedule';
import { MapPin, Clock, MessageSquare, Images, ExternalLink } from 'lucide-react';

interface WarungCardProps {
  warung: Warung;
  onSelect: (warung: Warung) => void;
  onOrderDirect: (warung: Warung) => void;
}

export const WarungCard: React.FC<WarungCardProps> = ({ warung, onSelect, onOrderDirect }) => {
  const photoCount = warung.daftar_foto?.length || 0;
  const coverImage = warung.logo || (warung.daftar_foto && (warung.daftar_foto[0]?.file_url || (warung.daftar_foto[0] as any)?.url)) || '';

  // Calculate day-by-day schedule for today
  const todaySchedule = getTodaySchedule(warung);

  // Address logic
  const hasManualAddress = Boolean(warung.alamat && warung.alamat.trim());
  const hasMapsUrl = Boolean(warung.maps_url && warung.maps_url.trim());

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
      {/* Clickable Header & Image */}
      <div onClick={() => onSelect(warung)} className="cursor-pointer flex flex-col relative">
        {/* Banner Cover / Logo */}
        <div className="relative h-44 sm:h-48 w-full bg-slate-100 overflow-hidden">
          {coverImage ? (
            <img
              src={coverImage}
              alt={warung.nama}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-100 via-teal-50 to-emerald-50 text-emerald-800">
              <Images className="w-12 h-12 text-emerald-600/60 mb-1" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Katalog Menu
              </span>
            </div>
          )}

          {/* Status Badge overlay (Calculated from today's schedule) */}
          {todaySchedule && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 bg-white/95 backdrop-blur-md rounded-xl shadow-xs text-xs font-extrabold uppercase">
              {todaySchedule.isLibur ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-amber-700">LIBUR</span>
                </>
              ) : todaySchedule.isOpen ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-700">BUKA</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span className="text-rose-600">TUTUP</span>
                </>
              )}
            </div>
          )}

          {/* Photo Counter */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/75 backdrop-blur-md rounded-xl text-xs font-bold text-white shadow-xs">
            <Images className="w-3.5 h-3.5 text-emerald-400" />
            <span>{photoCount}/50 FOTO</span>
          </div>
        </div>

        {/* Info Content */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-2.5">
          <div>
            {/* Category tag */}
            {warung.kategori && warung.kategori.trim() && (
              <div className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1">
                {warung.kategori}
              </div>
            )}

            {/* Nama Warung (Strictly UPPERCASE) */}
            <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors uppercase leading-snug line-clamp-2">
              {warung.nama}
            </h3>

            {/* Address (Only display if available! No empty placeholder) */}
            {hasManualAddress ? (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="line-clamp-2 leading-relaxed">{warung.alamat}</p>
              </div>
            ) : hasMapsUrl ? (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <a
                  href={warung.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>LIHAT LOKASI</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                </a>
              </div>
            ) : null}

            {/* Hours (Only display if today's hours are available! No empty placeholder) */}
            {todaySchedule && (
              <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {todaySchedule.isLibur ? 'Hari ini Libur' : `Hari ini: ${todaySchedule.displayText}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 grid grid-cols-2 gap-2 mt-auto">
        <button
          onClick={() => onSelect(warung)}
          className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Images className="w-4 h-4 text-emerald-700" />
          <span>Lihat Menu</span>
        </button>

        <button
          onClick={() => onOrderDirect(warung)}
          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 fill-white/20" />
          <span className="truncate">Pesan WA</span>
        </button>
      </div>
    </div>
  );
};
