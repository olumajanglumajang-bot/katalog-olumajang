import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Warung, ViewMode } from './types';
import { fetchWarungs, verifyAdminSession } from './services/api';
import { Navbar } from './components/Navbar';
import { WarungCard } from './components/WarungCard';
import { WarungDetail } from './components/WarungDetail';
import { OrderModal } from './components/OrderModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import {
  Search,
  Store,
  MessageSquare,
  Sparkles,
  PhoneCall,
  RefreshCw,
  AlertCircle,
  Share2,
} from 'lucide-react';

export default function App() {
  const [warungs, setWarungs] = useState<Warung[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View routing state
  const [viewMode, setViewMode] = useState<ViewMode>('catalog');
  const [selectedWarung, setSelectedWarung] = useState<Warung | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Modals state
  const [orderModalWarung, setOrderModalWarung] = useState<Warung | null>(null);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Load warung catalog data
  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWarungs();
      setWarungs(data);
      return data;
    } catch (err: any) {
      console.error('Error loading warungs:', err);
      setError(err.message || 'Gagal memuat katalog warung.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Check admin session and handle deep links on mount
  useEffect(() => {
    verifyAdminSession().then((isValid) => {
      setIsAdminLoggedIn(isValid);
    });

    loadCatalog().then((fetched) => {
      // Check deep link hash e.g. #warung-warung-bebek-mbak-sri
      const hash = window.location.hash;
      if (hash.startsWith('#warung-')) {
        const warungId = hash.replace('#warung-', '');
        const found = fetched.find((w) => w.id === warungId);
        if (found) {
          setSelectedWarung(found);
          setViewMode('warung_detail');
        }
      } else if (hash === '#admin' || window.location.pathname === '/admin') {
        verifyAdminSession().then((isValid) => {
          if (isValid) {
            setViewMode('admin');
          } else {
            setIsAdminLoginOpen(true);
          }
        });
      }
    });

    // Handle browser back button (PopState)
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.view === 'warung_detail' && e.state.warungId) {
        setViewMode('warung_detail');
        setSelectedWarung((prev) => warungs.find((w) => w.id === e.state.warungId) || prev);
      } else if (e.state?.view === 'admin') {
        setViewMode('admin');
      } else {
        setViewMode('catalog');
        setSelectedWarung(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadCatalog]);

  // Categories computed dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    set.add('Semua');
    warungs.forEach((w) => {
      if (w.kategori && w.kategori.trim()) {
        set.add(w.kategori.trim());
      }
    });
    return Array.from(set);
  }, [warungs]);

  // Filter and auto-sort A-Z strictly by normalized uppercase name
  const filteredWarungs = useMemo(() => {
    return warungs
      .filter((w) => {
        if (!w.is_active && viewMode !== 'admin') return false;

        const nameMatches = w.nama.toLowerCase().includes(searchQuery.toLowerCase());
        const addressMatches = w.alamat ? w.alamat.toLowerCase().includes(searchQuery.toLowerCase()) : false;
        const categoryMatches = w.kategori ? w.kategori.toLowerCase().includes(searchQuery.toLowerCase()) : false;

        const matchesQuery = nameMatches || addressMatches || categoryMatches;
        const matchesCategory =
          selectedCategory === 'Semua' || (w.kategori && w.kategori.toLowerCase() === selectedCategory.toLowerCase());

        return matchesQuery && matchesCategory;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' }));
  }, [warungs, searchQuery, selectedCategory, viewMode]);

  // Navigation handlers
  const handleSelectWarung = (warung: Warung) => {
    setSelectedWarung(warung);
    setViewMode('warung_detail');
    window.history.pushState({ view: 'warung_detail', warungId: warung.id }, '', `#warung-${warung.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    setViewMode('catalog');
    setSelectedWarung(null);
    window.history.pushState({ view: 'catalog' }, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAdmin = () => {
    if (isAdminLoggedIn) {
      setViewMode('admin');
      window.history.pushState({ view: 'admin' }, '', '#admin');
    } else {
      setIsAdminLoginOpen(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    setIsAdminLoginOpen(false);
    setViewMode('admin');
    window.history.pushState({ view: 'admin' }, '', '#admin');
  };

  const handleDirectOrder = (warung: Warung) => {
    setOrderModalWarung(warung);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      {viewMode !== 'admin' && (
        <Navbar
          viewMode={viewMode}
          onNavigateHome={handleNavigateHome}
          onOpenAdmin={handleOpenAdmin}
          isAdminLoggedIn={isAdminLoggedIn}
          selectedWarungName={selectedWarung?.nama}
        />
      )}

      {/* Main View Router */}
      {viewMode === 'admin' ? (
        <AdminDashboard
          warungs={warungs}
          onRefresh={async () => {
            await loadCatalog();
          }}
          onExitAdmin={handleNavigateHome}
          onPreviewWarung={(w) => {
            setSelectedWarung(w);
            setViewMode('warung_detail');
          }}
        />
      ) : viewMode === 'warung_detail' && selectedWarung ? (
        <WarungDetail
          warung={selectedWarung}
          onBack={handleNavigateHome}
          onOrder={() => setOrderModalWarung(selectedWarung)}
        />
      ) : (
        /* =========================================================
           HALAMAN UTAMA KATALOG (PELANGGAN)
           ========================================================= */
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24">
          {/* Full Color Hero Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-5 sm:p-7 text-white shadow-md mb-6 relative overflow-hidden">
            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-xl text-xs font-black uppercase tracking-wider mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>KATALOG RESMI OLUMAJANG</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight">
                PILIH WARUNG → LIHAT FOTO MENU → PESAN KE WHATSAPP
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-2 leading-relaxed">
                Katalog foto menu kuliner dan warung terbaik di Lumajang. Tanpa ribet, langsung hubungi admin WhatsApp pusat.
              </p>
            </div>

            {/* Decorative background logo */}
            <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none">
              <Store className="w-64 h-64 text-white" />
            </div>
          </div>

          {/* Search Bar & Category Filter */}
          <div className="space-y-3 mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Cari warung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Hapus
                </button>
              )}
            </div>

            {/* Categories Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {categories.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Catalog Count & Sort Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-4 px-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <span>Menampilkan:</span>
              <strong className="text-slate-800">{filteredWarungs.length} Warung</strong>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-700 uppercase font-black">URUTAN A–Z</span>
            </div>

            {loading && (
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memuat...</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal terhubung ke katalog</p>
                <p className="mt-0.5">{error}</p>
                <button
                  onClick={loadCatalog}
                  className="mt-2 px-3 py-1 bg-rose-600 text-white font-bold rounded-lg text-xs hover:bg-rose-700 transition-colors"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* Warungs Grid (Sorted strictly A-Z) */}
          {loading && warungs.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 animate-pulse">
                  <div className="h-44 bg-slate-200 rounded-2xl" />
                  <div className="h-5 bg-slate-200 rounded-lg w-3/4" />
                  <div className="h-4 bg-slate-200 rounded-lg w-1/2" />
                  <div className="h-10 bg-slate-200 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : filteredWarungs.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200 shadow-sm my-4">
              <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase">
                WARUNG TIDAK DITEMUKAN
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada warung dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                  : 'Belum ada warung yang terdaftar.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  TAMPILKAN SEMUA WARUNG
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredWarungs.map((warung) => (
                <WarungCard
                  key={warung.id}
                  warung={warung}
                  onSelect={handleSelectWarung}
                  onOrderDirect={handleDirectOrder}
                />
              ))}
            </div>
          )}

          {/* Bottom WhatsApp Order Help Box */}
          <div className="mt-10 p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase">
                  Pusat Pemesanan & Bantuan Olumajang
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seluruh pesanan dilayani langsung melalui WhatsApp Pusat: <strong>081334274818</strong>
                </p>
              </div>
            </div>

            <a
              href="https://wa.me/6281334274818"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>CHAT WHATSAPP PUSAT</span>
            </a>
          </div>
        </main>
      )}

      {/* Order Form Modal (Starts Empty except auto warung name) */}
      {orderModalWarung && (
        <OrderModal
          warung={orderModalWarung}
          isOpen={Boolean(orderModalWarung)}
          onClose={() => setOrderModalWarung(null)}
        />
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />
    </div>
  );
}
