import React, { useState, useRef } from 'react';
import { Warung, Photo, DayKey } from '../types';
import {
  createWarung,
  updateWarung,
  deleteWarung,
  uploadWarungLogo,
  deleteWarungLogo,
  uploadWarungPhotos,
  deleteWarungPhoto,
  reorderWarungPhotos,
  logoutAdmin,
} from '../services/api';
import { DAY_KEYS, DAY_NAMES } from '../utils/schedule';
import { compressImagesBatch, formatBytes, CompressionProgress } from '../utils/compressor';
import {
  Plus,
  Edit2,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  LogOut,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Images,
  X,
  Search,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface AdminDashboardProps {
  warungs: Warung[];
  onRefresh: () => Promise<void>;
  onExitAdmin: () => void;
  onPreviewWarung: (warung: Warung) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  warungs,
  onRefresh,
  onExitAdmin,
  onPreviewWarung,
}) => {
  const [selectedWarungId, setSelectedWarungId] = useState<string>(warungs[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingWarung, setIsEditingWarung] = useState(false);
  const [isAddingWarung, setIsAddingWarung] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [compressionStats, setCompressionStats] = useState<{ original: number; compressed: number } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Dedicated custom confirmation dialog states for 100% reliable click-handling
  const [warungToDelete, setWarungToDelete] = useState<Warung | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<{ id: string; url: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form state for creating / editing warung
  const [warungFormData, setWarungFormData] = useState({
    nama: '',
    alamat: '',
    maps_url: '',
    kategori: 'Makanan & Minuman',
    senin_buka: '',
    senin_tutup: '',
    senin_libur: false,
    selasa_buka: '',
    selasa_tutup: '',
    selasa_libur: false,
    rabu_buka: '',
    rabu_tutup: '',
    rabu_libur: false,
    kamis_buka: '',
    kamis_tutup: '',
    kamis_libur: false,
    jumat_buka: '',
    jumat_tutup: '',
    jumat_libur: false,
    sabtu_buka: '',
    sabtu_tutup: '',
    sabtu_libur: false,
    minggu_buka: '',
    minggu_tutup: '',
    minggu_libur: false,
    status: 'buka' as 'buka' | 'tutup',
    is_active: true,
  });

  const selectedWarung = warungs.find((w) => w.id === selectedWarungId) || warungs[0];
  const photoCount = selectedWarung?.daftar_foto?.length || 0;
  const isPhotoLimitReached = photoCount >= 50;

  // Filter warungs for admin sidebar
  const filteredWarungs = warungs.filter((w) =>
    w.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.kategori && w.kategori.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const showNotification = (type: 'success' | 'error' | 'warning', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  const handleLogout = async () => {
    await logoutAdmin();
    onExitAdmin();
  };

  const openAddWarung = () => {
    setWarungFormData({
      nama: '',
      alamat: '',
      maps_url: '',
      kategori: 'Makanan & Minuman',
      senin_buka: '',
      senin_tutup: '',
      senin_libur: false,
      selasa_buka: '',
      selasa_tutup: '',
      selasa_libur: false,
      rabu_buka: '',
      rabu_tutup: '',
      rabu_libur: false,
      kamis_buka: '',
      kamis_tutup: '',
      kamis_libur: false,
      jumat_buka: '',
      jumat_tutup: '',
      jumat_libur: false,
      sabtu_buka: '',
      sabtu_tutup: '',
      sabtu_libur: false,
      minggu_buka: '',
      minggu_tutup: '',
      minggu_libur: false,
      status: 'buka',
      is_active: true,
    });
    setIsAddingWarung(true);
  };

  const openEditWarung = (warung: Warung) => {
    setWarungFormData({
      nama: warung.nama,
      alamat: warung.alamat || '',
      maps_url: warung.maps_url || '',
      kategori: warung.kategori || 'Makanan & Minuman',
      senin_buka: warung.senin_buka || '',
      senin_tutup: warung.senin_tutup || '',
      senin_libur: Boolean(warung.senin_libur),
      selasa_buka: warung.selasa_buka || '',
      selasa_tutup: warung.selasa_tutup || '',
      selasa_libur: Boolean(warung.selasa_libur),
      rabu_buka: warung.rabu_buka || '',
      rabu_tutup: warung.rabu_tutup || '',
      rabu_libur: Boolean(warung.rabu_libur),
      kamis_buka: warung.kamis_buka || '',
      kamis_tutup: warung.kamis_tutup || '',
      kamis_libur: Boolean(warung.kamis_libur),
      jumat_buka: warung.jumat_buka || '',
      jumat_tutup: warung.jumat_tutup || '',
      jumat_libur: Boolean(warung.jumat_libur),
      sabtu_buka: warung.sabtu_buka || '',
      sabtu_tutup: warung.sabtu_tutup || '',
      sabtu_libur: Boolean(warung.sabtu_libur),
      minggu_buka: warung.minggu_buka || '',
      minggu_tutup: warung.minggu_tutup || '',
      minggu_libur: Boolean(warung.minggu_libur),
      status: warung.status,
      is_active: warung.is_active,
    });
    setIsEditingWarung(true);
  };

  const handleSaveAddWarung = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warungFormData.nama.trim()) {
      showNotification('error', 'Nama warung wajib diisi!');
      return;
    }

    try {
      const created = await createWarung(warungFormData);
      await onRefresh();
      setSelectedWarungId(created.id);
      setIsAddingWarung(false);
      showNotification('success', `Warung "${created.nama}" berhasil ditambahkan.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menambahkan warung.');
    }
  };

  const handleSaveEditWarung = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarung) return;
    if (!warungFormData.nama.trim()) {
      showNotification('error', 'Nama warung wajib diisi!');
      return;
    }

    try {
      await updateWarung(selectedWarung.id, warungFormData);
      await onRefresh();
      setIsEditingWarung(false);
      showNotification('success', `Data warung "${warungFormData.nama.toUpperCase()}" berhasil disimpan.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menyimpan perubahan warung.');
    }
  };

  const handleDeleteWarung = (warung: Warung) => {
    setWarungToDelete(warung);
  };

  const handleConfirmDeleteWarung = async () => {
    if (!warungToDelete) return;
    setIsDeleting(true);

    try {
      await deleteWarung(warungToDelete.id);
      await onRefresh();
      showNotification('success', 'Warung berhasil dihapus.');

      if (selectedWarungId === warungToDelete.id) {
        const remaining = warungs.filter((w) => w.id !== warungToDelete.id);
        setSelectedWarungId(remaining[0]?.id || '');
      }
      setWarungToDelete(null);
    } catch (err: any) {
      console.error('[Admin] Gagal menghapus warung:', err);
      showNotification('error', 'Gagal menghapus warung. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeleteWarung = () => {
    setWarungToDelete(null);
  };

  // LOGO UPLOAD & DELETE HANDLERS (From Gallery, NO manual URL)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWarung) return;

    setUploadingLogo(true);
    try {
      await uploadWarungLogo(selectedWarung.id, file);
      await onRefresh();
      showNotification('success', 'Logo warung berhasil diunggah.');
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal mengunggah logo.');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!selectedWarung || !selectedWarung.logo) return;
    if (!confirm('Hapus logo warung ini?')) return;

    setUploadingLogo(true);
    try {
      await deleteWarungLogo(selectedWarung.id);
      await onRefresh();
      showNotification('success', 'Logo warung berhasil dihapus.');
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menghapus logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // BULK PHOTO UPLOAD WITH SMART QUOTA & AUTO-COMPRESSION (MAX 50 PER WARUNG)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0 || !selectedWarung) return;

    const remainingQuota = Math.max(0, 50 - photoCount);
    if (remainingQuota <= 0) {
      showNotification('warning', 'MAKSIMAL 50 FOTO UNTUK SATU WARUNG.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    const selectedFileArray = Array.from(rawFiles);
    // Strict quota enforcement: take up to remaining quota
    const acceptedRawFiles = selectedFileArray.slice(0, remainingQuota);
    const rejectedCount = selectedFileArray.length - acceptedRawFiles.length;

    setUploadingPhotos(true);
    setCompressionStats(null);

    try {
      // Step 1: Automatic background compression preserving menu text sharpness
      const { files: compressedFiles, totalOriginalBytes, totalCompressedBytes } = await compressImagesBatch(
        acceptedRawFiles,
        (progress) => {
          setCompressionProgress(progress);
        }
      );

      setCompressionStats({
        original: totalOriginalBytes,
        compressed: totalCompressedBytes,
      });

      // Step 2: Upload compressed files to server storage
      await uploadWarungPhotos(selectedWarung.id, compressedFiles);
      await onRefresh();

      if (rejectedCount > 0) {
        showNotification(
          'warning',
          `Berhasil upload ${compressedFiles.length} foto. (${rejectedCount} foto ditolak karena batas maksimal 50 foto).`
        );
      } else {
        showNotification('success', `Berhasil mengunggah ${compressedFiles.length} foto menu.`);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal mengunggah foto.');
    } finally {
      setUploadingPhotos(false);
      setCompressionProgress(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = (photo: { id: string; url: string }) => {
    setPhotoToDelete(photo);
  };

  const handleConfirmDeletePhoto = async () => {
    if (!selectedWarung || !photoToDelete) return;
    setIsDeleting(true);

    try {
      await deleteWarungPhoto(selectedWarung.id, photoToDelete.id);
      await onRefresh();
      showNotification('success', 'Foto menu berhasil dihapus.');
      setPhotoToDelete(null);
    } catch (err: any) {
      console.error('[Admin] Gagal menghapus foto:', err);
      showNotification('error', 'Gagal menghapus foto. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeletePhoto = () => {
    setPhotoToDelete(null);
  };

  const handleMovePhoto = async (index: number, direction: 'up' | 'down') => {
    if (!selectedWarung) return;
    const photos = [...selectedWarung.daftar_foto];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const temp = photos[index];
    photos[index] = photos[targetIndex];
    photos[targetIndex] = temp;

    try {
      const photoIds = photos.map((p) => p.id);
      await reorderWarungPhotos(selectedWarung.id, photoIds);
      await onRefresh();
      showNotification('success', 'Urutan foto menu diperbarui.');
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal mengubah urutan foto.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-black tracking-wider uppercase">
              PANEL ADMIN
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 hidden sm:block uppercase">
              Editor Katalog Olumajang
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {selectedWarung && (
              <button
                onClick={() => onPreviewWarung(selectedWarung)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200 cursor-pointer"
                title="Lihat Tampilan Pelanggan"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pratinjau Pelanggan</span>
              </button>
            )}

            <button
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <span>Ke Katalog</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200 cursor-pointer"
              title="Keluar dari Admin"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Status Notification */}
      {statusMessage && (
        <div className="fixed top-16 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2 text-xs sm:text-sm font-bold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : statusMessage.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            {statusMessage.type === 'error' && <X className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Admin Workspace: 2-Column Responsive Layout */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Daftar Warung (A-Z) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">DAFTAR WARUNG (A–Z)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Total: {warungs.length} warung terdaftar</p>
              </div>

              <button
                onClick={openAddWarung}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Warung</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari warung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            {/* Scrollable Warung List */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredWarungs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Tidak ada warung yang sesuai pencarian.
                </div>
              ) : (
                filteredWarungs.map((warung) => {
                  const isSelected = selectedWarung?.id === warung.id;

                  return (
                    <div
                      key={warung.id}
                      onClick={() => setSelectedWarungId(warung.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate uppercase">
                            {warung.nama}
                          </h4>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {warung.kategori || 'Kuliner'} · {warung.daftar_foto?.length || 0}/50 FOTO
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditWarung(warung)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Edit Warung"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteWarung(warung)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="Hapus Warung"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Warung Details, Logo, and Menu Photos */}
        <div className="lg:col-span-7 flex flex-col space-y-5">
          {selectedWarung ? (
            <>
              {/* Selected Warung Card & Logo Management */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Logo display with replace button */}
                    <div className="relative group shrink-0">
                      {selectedWarung.logo ? (
                        <img
                          src={selectedWarung.logo}
                          alt={selectedWarung.nama}
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex flex-col items-center justify-center border border-emerald-200 text-center p-1">
                          <ImageIcon className="w-6 h-6 opacity-60" />
                          <span className="text-[9px] font-bold">Tanpa Logo</span>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-bold text-emerald-700 uppercase">
                        {selectedWarung.kategori || 'Kuliner'}
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase truncate">
                        {selectedWarung.nama}
                      </h3>
                      {selectedWarung.alamat ? (
                        <p className="text-xs text-slate-600 truncate mt-0.5">{selectedWarung.alamat}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEditWarung(selectedWarung)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit Info</span>
                    </button>

                    <button
                      onClick={() => handleDeleteWarung(selectedWarung)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Hapus Warung"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus Warung</span>
                    </button>
                  </div>
                </div>

                {/* Logo Upload from Phone Gallery (Section 4 Requirement) */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Logo Warung</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload langsung foto/logo dari galeri HP Anda (tanpa perlu ketik URL).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploadingLogo}
                    />

                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {uploadingLogo ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{selectedWarung.logo ? 'Ganti Logo' : 'Upload Logo'}</span>
                    </button>

                    {selectedWarung.logo && (
                      <button
                        onClick={handleDeleteLogo}
                        disabled={uploadingLogo}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
                        title="Hapus Logo"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Menu Management Section (Section 5 Requirement) */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-base font-black text-slate-900 flex items-center gap-2 uppercase">
                      <Images className="w-4 h-4 text-emerald-600" />
                      <span>FOTO MENU WARUNG</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Maksimal 50 foto menu. Upload banyak foto sekaligus dari galeri HP.
                    </p>
                  </div>

                  {/* 50 Photo Counter: 0/50 FOTO or 37/50 FOTO */}
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-right">
                      <div className="text-xs font-black text-slate-900">
                        <span className={photoCount >= 50 ? 'text-rose-600' : 'text-emerald-700'}>
                          {photoCount}
                        </span>
                        <span className="text-slate-400 font-normal"> / 50 FOTO</span>
                      </div>
                    </div>

                    <input
                      ref={photoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={isPhotoLimitReached || uploadingPhotos}
                    />

                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isPhotoLimitReached || uploadingPhotos}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
                        isPhotoLimitReached
                          ? 'bg-slate-400 cursor-not-allowed opacity-60'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                      }`}
                    >
                      {uploadingPhotos ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            {compressionProgress
                              ? `Kompresi ${compressionProgress.current}/${compressionProgress.total}...`
                              : 'Mengunggah...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>PILIH BANYAK FOTO</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Compression Progress Bar */}
                {uploadingPhotos && compressionProgress && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span>Kompresi Otomatis (Tulisan Menu Tetap Jelas): {compressionProgress.current} dari {compressionProgress.total} foto</span>
                      </span>
                      <span>{compressionProgress.percentage}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-emerald-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-150 rounded-full"
                        style={{ width: `${compressionProgress.percentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-emerald-700 truncate">
                      Sedang memproses: {compressionProgress.currentFileName}
                    </p>
                  </div>
                )}

                {/* Compression Savings Stat */}
                {compressionStats && !uploadingPhotos && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        Kompresi Berhasil: Dari <strong>{formatBytes(compressionStats.original)}</strong> menjadi{' '}
                        <strong>{formatBytes(compressionStats.compressed)}</strong> (Hemat{' '}
                        {Math.round(((compressionStats.original - compressionStats.compressed) / (compressionStats.original || 1)) * 100)}%)
                      </span>
                    </div>
                    <button
                      onClick={() => setCompressionStats(null)}
                      className="text-emerald-700 hover:text-emerald-900 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Limit alert */}
                {isPhotoLimitReached && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>MAKSIMAL 50 FOTO UNTUK SATU WARUNG. Hapus foto lama untuk menambah foto baru.</span>
                  </div>
                )}

                {/* Photo Grid */}
                {selectedWarung.daftar_foto?.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Images className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700 uppercase">Belum ada foto menu</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Pilih banyak foto menu sekaligus dari galeri HP untuk mengisi katalog warung ini.
                    </p>
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer"
                    >
                      Pilih Foto Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedWarung.daftar_foto.map((photo, index) => {
                      const url = photo.file_url || (photo as any).url;
                      return (
                        <div
                          key={photo.id}
                          className="group relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-xs aspect-square flex flex-col justify-between"
                        >
                          <img
                            src={url}
                            alt={`Menu ${index + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />

                          {/* Top bar: index and delete */}
                          <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-black rounded-md">
                              #{index + 1}
                            </span>

                            <button
                              onClick={() => handleDeletePhoto({ id: photo.id, url })}
                              className="w-7 h-7 rounded-xl bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center shadow-md transition-colors cursor-pointer"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Bottom bar: reorder buttons */}
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 z-10 bg-black/60 backdrop-blur-xs p-1 rounded-xl">
                            <button
                              onClick={() => handleMovePhoto(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-white hover:text-emerald-400 disabled:opacity-20 cursor-pointer transition-colors"
                              title="Geser ke urutan sebelumnya"
                            >
                              <ArrowUp className="w-4 h-4 -rotate-90" />
                            </button>

                            <span className="text-[10px] text-white/90 font-mono px-1">
                              Urutan
                            </span>

                            <button
                              onClick={() => handleMovePhoto(index, 'down')}
                              disabled={index === selectedWarung.daftar_foto.length - 1}
                              className="p-1 text-white hover:text-emerald-400 disabled:opacity-20 cursor-pointer transition-colors"
                              title="Geser ke urutan berikutnya"
                            >
                              <ArrowDown className="w-4 h-4 -rotate-90" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
              Pilih warung di sebelah kiri untuk mengelola katalog menu.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Tambah Warung Baru */}
      {isAddingWarung && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase">Tambah Warung Baru</h3>
              <button
                onClick={() => setIsAddingWarung(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddWarung} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  NAMA WARUNG <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: WARUNG BU SITI"
                  value={warungFormData.nama}
                  onChange={(e) => setWarungFormData({ ...warungFormData, nama: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama otomatis ditampilkan dalam HURUF KAPITAL.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ALAMAT WARUNG <span className="text-slate-400 font-normal">(Boleh dikosongkan)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ketik alamat manual jika ada..."
                  value={warungFormData.alamat}
                  onChange={(e) => setWarungFormData({ ...warungFormData, alamat: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  LINK GOOGLE MAPS <span className="text-slate-400 font-normal">(Boleh dikosongkan)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/?q=..."
                  value={warungFormData.maps_url}
                  onChange={(e) => setWarungFormData({ ...warungFormData, maps_url: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  KATEGORI
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ayam & Bebek, Bakso & Mie, Aneka Nasi, Kopi & Camilan"
                  value={warungFormData.kategori}
                  onChange={(e) => setWarungFormData({ ...warungFormData, kategori: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Day-by-Day Schedule Form (Senin to Minggu) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Jadwal Operasional (Senin – Minggu)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Boleh dikosongkan</span>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {DAY_KEYS.map((day) => {
                    const bukaKey = `${day}_buka` as keyof typeof warungFormData;
                    const tutupKey = `${day}_tutup` as keyof typeof warungFormData;
                    const liburKey = `${day}_libur` as keyof typeof warungFormData;
                    const isLibur = Boolean(warungFormData[liburKey]);

                    return (
                      <div key={day} className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60 last:border-0">
                        <span className="font-bold uppercase text-xs w-20 text-slate-700">
                          {DAY_NAMES[day]}
                        </span>

                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            disabled={isLibur}
                            value={(warungFormData[bukaKey] as string) || ''}
                            onChange={(e) => setWarungFormData({ ...warungFormData, [bukaKey]: e.target.value })}
                            className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-40"
                          />
                          <span className="text-slate-400">–</span>
                          <input
                            type="time"
                            disabled={isLibur}
                            value={(warungFormData[tutupKey] as string) || ''}
                            onChange={(e) => setWarungFormData({ ...warungFormData, [tutupKey]: e.target.value })}
                            className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-40"
                          />
                        </div>

                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isLibur}
                            onChange={(e) => setWarungFormData({ ...warungFormData, [liburKey]: e.target.checked })}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className={isLibur ? 'text-rose-600 font-bold' : 'text-slate-500'}>LIBUR</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingWarung(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Simpan Warung
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Info Warung */}
      {isEditingWarung && selectedWarung && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase">Edit Info Warung</h3>
              <button
                onClick={() => setIsEditingWarung(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditWarung} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  NAMA WARUNG <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={warungFormData.nama}
                  onChange={(e) => setWarungFormData({ ...warungFormData, nama: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ALAMAT WARUNG <span className="text-slate-400 font-normal">(Boleh dikosongkan)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ketik alamat manual jika ada..."
                  value={warungFormData.alamat}
                  onChange={(e) => setWarungFormData({ ...warungFormData, alamat: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  LINK GOOGLE MAPS <span className="text-slate-400 font-normal">(Boleh dikosongkan)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/?q=..."
                  value={warungFormData.maps_url}
                  onChange={(e) => setWarungFormData({ ...warungFormData, maps_url: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  KATEGORI
                </label>
                <input
                  type="text"
                  value={warungFormData.kategori}
                  onChange={(e) => setWarungFormData({ ...warungFormData, kategori: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Day-by-Day Schedule Form (Senin to Minggu) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Jadwal Operasional (Senin – Minggu)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Boleh dikosongkan</span>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {DAY_KEYS.map((day) => {
                    const bukaKey = `${day}_buka` as keyof typeof warungFormData;
                    const tutupKey = `${day}_tutup` as keyof typeof warungFormData;
                    const liburKey = `${day}_libur` as keyof typeof warungFormData;
                    const isLibur = Boolean(warungFormData[liburKey]);

                    return (
                      <div key={day} className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60 last:border-0">
                        <span className="font-bold uppercase text-xs w-20 text-slate-700">
                          {DAY_NAMES[day]}
                        </span>

                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            disabled={isLibur}
                            value={(warungFormData[bukaKey] as string) || ''}
                            onChange={(e) => setWarungFormData({ ...warungFormData, [bukaKey]: e.target.value })}
                            className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-40"
                          />
                          <span className="text-slate-400">–</span>
                          <input
                            type="time"
                            disabled={isLibur}
                            value={(warungFormData[tutupKey] as string) || ''}
                            onChange={(e) => setWarungFormData({ ...warungFormData, [tutupKey]: e.target.value })}
                            className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs disabled:opacity-40"
                          />
                        </div>

                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isLibur}
                            onChange={(e) => setWarungFormData({ ...warungFormData, [liburKey]: e.target.checked })}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className={isLibur ? 'text-rose-600 font-bold' : 'text-slate-500'}>LIBUR</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingWarung(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: HAPUS WARUNG */}
      {warungToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Konfirmasi Hapus Warung
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Yakin ingin menghapus <strong className="text-slate-900">{warungToDelete.nama.toUpperCase()}</strong>?
              </p>
              <p className="text-[11px] text-slate-400">
                Seluruh data, logo, jadwal, alamat, dan foto menu warung ini akan dihapus permanen dari server.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelDeleteWarung}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                BATAL
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteWarung}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-black text-xs transition-all shadow-xs cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>HAPUS</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: HAPUS FOTO MENU */}
      {photoToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto border border-slate-200 shadow-xs">
              <img
                src={photoToDelete.url}
                alt="Foto yang akan dihapus"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Hapus foto menu ini?
              </h3>
              <p className="text-xs text-slate-500">
                File foto akan dihapus permanen dari penyimpanan server dan katalog warung.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelDeletePhoto}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                BATAL
              </button>

              <button
                type="button"
                onClick={handleConfirmDeletePhoto}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-black text-xs transition-all shadow-xs cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>HAPUS</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
