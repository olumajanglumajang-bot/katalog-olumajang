import { Warung, DayKey } from '../types';

export const DAY_KEYS: DayKey[] = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

export const DAY_NAMES: Record<DayKey, string> = {
  senin: 'Senin',
  selasa: 'Selasa',
  rabu: 'Rabu',
  kamis: 'Kamis',
  jumat: 'Jumat',
  sabtu: 'Sabtu',
  minggu: 'Minggu',
};

export function getTodayKey(): DayKey {
  const day = new Date().getDay(); // 0 is Sunday, 1 is Monday, etc.
  switch (day) {
    case 1:
      return 'senin';
    case 2:
      return 'selasa';
    case 3:
      return 'rabu';
    case 4:
      return 'kamis';
    case 5:
      return 'jumat';
    case 6:
      return 'sabtu';
    case 0:
    default:
      return 'minggu';
  }
}

export interface TodayStatusResult {
  hasData: boolean;
  isLibur: boolean;
  isOpen: boolean;
  label: string;
  jamBuka?: string;
  jamTutup?: string;
  displayText: string;
}

export function getTodaySchedule(warung: Warung): TodayStatusResult | null {
  const todayKey = getTodayKey();
  const isLibur = Boolean((warung as any)[`${todayKey}_libur`]);
  const buka = (warung as any)[`${todayKey}_buka`]?.trim() || '';
  const tutup = (warung as any)[`${todayKey}_tutup`]?.trim() || '';

  if (isLibur) {
    return {
      hasData: true,
      isLibur: true,
      isOpen: false,
      label: 'LIBUR',
      displayText: 'HARI INI LIBUR',
    };
  }

  if (!buka && !tutup) {
    // If not set at all, DO NOT display empty placeholder
    return null;
  }

  // Calculate current open/closed based on time
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let isOpen = warung.status === 'buka' && warung.is_active;

  if (buka && tutup) {
    const [bH, bM] = buka.split(':').map((v: string) => parseInt(v, 10) || 0);
    const [tH, tM] = tutup.split(':').map((v: string) => parseInt(v, 10) || 0);
    const bukaMinutes = bH * 60 + bM;
    const tutupMinutes = tH * 60 + tM;

    if (tutupMinutes > bukaMinutes) {
      isOpen = isOpen && currentMinutes >= bukaMinutes && currentMinutes <= tutupMinutes;
    } else {
      // Overnight (e.g. 18:00 - 02:00)
      isOpen = isOpen && (currentMinutes >= bukaMinutes || currentMinutes <= tutupMinutes);
    }
  }

  return {
    hasData: true,
    isLibur: false,
    isOpen,
    label: isOpen ? 'BUKA' : 'TUTUP',
    jamBuka: buka,
    jamTutup: tutup,
    displayText: buka && tutup ? `${buka} – ${tutup} WIB` : buka ? `Buka: ${buka} WIB` : `Tutup: ${tutup} WIB`,
  };
}
