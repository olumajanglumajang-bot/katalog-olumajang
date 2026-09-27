import React from 'react';
import { UtensilsCrossed, ShieldCheck, ArrowLeft, PhoneCall } from 'lucide-react';
import { ViewMode } from '../types';

interface NavbarProps {
  viewMode: ViewMode;
  onNavigateHome: () => void;
  onOpenAdmin: () => void;
  isAdminLoggedIn: boolean;
  selectedWarungName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  onNavigateHome,
  onOpenAdmin,
  isAdminLoggedIn,
  selectedWarungName,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 pt-safe">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Left Zone: Back button or Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          {viewMode !== 'catalog' ? (
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 -ml-1 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke Katalog"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-600" />
              <span className="truncate">Katalog</span>
            </button>
          ) : null}

          <div
            onClick={onNavigateHome}
            className="flex items-center gap-2 cursor-pointer select-none group min-w-0"
          >
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors uppercase truncate">
                {viewMode === 'warung_detail' && selectedWarungName
                  ? selectedWarungName
                  : 'KATALOG OLUMAJANG'}
              </h1>
              {viewMode === 'catalog' && (
                <p className="hidden sm:block text-[11px] text-slate-500 font-semibold -mt-0.5">
                  Katalog Kuliner & Warung Lumajang
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Zone: WhatsApp Center Info & Admin Entry */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://wa.me/6281334274818"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200"
            title="Hubungi Admin WhatsApp Pusat"
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
            <span>0813-3427-4818</span>
          </a>

          <button
            onClick={onOpenAdmin}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
              isAdminLoggedIn
                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAdminLoggedIn ? 'PANEL ADMIN' : 'ADMIN'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
