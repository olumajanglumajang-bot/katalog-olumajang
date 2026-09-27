export interface Photo {
  id: string;
  warung_id: string;
  file_url: string;
  file_name: string;
  urutan: number;
  created_at: string;
}

export type DayKey = 'senin' | 'selasa' | 'rabu' | 'kamis' | 'jumat' | 'sabtu' | 'minggu';

export interface DaySchedule {
  buka: string;
  tutup: string;
  libur: boolean;
}

export interface Warung {
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
  daftar_foto: Photo[];
  created_at: string;
  updated_at: string;
}

export interface OrderFormData {
  namaPemesan: string;
  namaWarung: string;
  alamatJemput: string;
  alamatTujuan: string;
  pesanan: string;
  metodePembayaran: 'Tunai' | 'Transfer';
  catatanTambahan: string;
}

export type ViewMode = 'catalog' | 'warung_detail' | 'admin';
