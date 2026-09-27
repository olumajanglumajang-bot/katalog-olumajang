import { Warung, Photo } from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return sessionStorage.getItem('admin_session_token');
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem('admin_session_token', token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem('admin_session_token');
}

export async function fetchWarungs(): Promise<Warung[]> {
  try {
    const res = await fetch(`${API_BASE}/warung`);
    if (!res.ok) {
      throw new Error(`Gagal mengambil data katalog (${res.status})`);
    }
    const data = await res.json();
    const warungs: Warung[] = data.warungs || [];
    // Strict A-Z sorting based on uppercase normalized warung name
    return warungs.sort((a, b) =>
      a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
    );
  } catch (err) {
    console.error('Fetch warungs failed:', err);
    throw err;
  }
}

export async function loginAdmin(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Kata sandi salah.' };
    }

    if (data.token) {
      setAuthToken(data.token);
    }
    return { success: true, token: data.token };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghubungi server.' };
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/admin/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export async function logoutAdmin(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/admin/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // ignore
    }
  }
  clearAuthToken();
}

export async function createWarung(warungData: Partial<Warung>): Promise<Warung> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/warung`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(warungData),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal membuat warung.');
  }
  return data.warung;
}

export async function updateWarung(id: string, warungData: Partial<Warung>): Promise<Warung> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/warung/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(warungData),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memperbarui warung.');
  }
  return data.warung;
}

export async function deleteWarung(id: string): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/warung/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Gagal menghapus warung.');
  }
}

// Logo upload from gallery (no manual URL needed)
export async function uploadWarungLogo(warungId: string, file: File): Promise<Warung> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('logo', file);

  const res = await fetch(`${API_BASE}/warung/${warungId}/logo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengunggah logo warung.');
  }
  return data.warung;
}

export async function deleteWarungLogo(warungId: string): Promise<Warung> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/warung/${warungId}/logo`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menghapus logo warung.');
  }
  return data.warung;
}

export async function uploadWarungPhotos(
  warungId: string,
  files: File[]
): Promise<{ addedPhotos: Photo[]; totalPhotos: number; warung: Warung }> {
  const token = getAuthToken();
  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file);
  }

  const res = await fetch(`${API_BASE}/warung/${warungId}/photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengunggah foto.');
  }
  return data;
}

export async function deleteWarungPhoto(
  warungId: string,
  photoId: string
): Promise<{ totalPhotos: number; warung: Warung }> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/warung/${warungId}/photos/${photoId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menghapus foto.');
  }
  return data;
}

export async function reorderWarungPhotos(warungId: string, photoIds: string[]): Promise<Warung> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/warung/${warungId}/photos/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ photoIds }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengubah urutan foto.');
  }
  return data.warung;
}
