import { Warung, Photo } from '../types';

export function getAuthToken(): string | null {
  return sessionStorage.getItem('admin_session_token');
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem('admin_session_token', token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem('admin_session_token');
}

/**
 * Universal API fetcher that supports:
 * 1. Standard /api path (rewritten by Netlify redirects or local dev server)
 * 2. Direct /.netlify/functions/api path fallback if /api returns 404
 * 3. Static /data/catalog.json fallback for public catalog
 */
async function apiFetch(subpath: string, options: RequestInit = {}): Promise<Response> {
  const cleanSubpath = subpath.startsWith('/') ? subpath : `/${subpath}`;

  // 1. Try standard /api path
  try {
    const res = await fetch(`/api${cleanSubpath}`, options);
    if (res.status !== 404) {
      return res;
    }
  } catch (err) {
    console.warn(`[API] Fetch /api${cleanSubpath} error, trying Netlify Functions directly:`, err);
  }

  // 2. Direct Netlify Functions URL fallback
  try {
    const directRes = await fetch(`/.netlify/functions/api${cleanSubpath}`, options);
    if (directRes.status !== 404) {
      return directRes;
    }
  } catch (err) {
    console.warn(`[API] Fetch /.netlify/functions/api${cleanSubpath} error:`, err);
  }

  // 3. Static catalog.json fallback for GET /warung
  if (cleanSubpath === '/warung' && (!options.method || options.method.toUpperCase() === 'GET')) {
    try {
      const staticRes = await fetch('/data/catalog.json');
      if (staticRes.ok) {
        return staticRes;
      }
    } catch {}
  }

  // Final fallback to original endpoint
  return await fetch(`/api${cleanSubpath}`, options);
}

/**
 * Helper to convert browser File object to Base64 Data URL.
 * Ensures zero filesystem loss on serverless Netlify environments.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function fetchWarungs(): Promise<Warung[]> {
  try {
    const res = await apiFetch('/warung');
    if (!res.ok) {
      throw new Error(`Gagal mengambil data katalog (${res.status})`);
    }
    const data = await res.json();
    const warungs: Warung[] = data.warungs || [];
    
    // Save to local cache for instant offline/cold-start loading
    if (warungs.length > 0) {
      try {
        localStorage.setItem('olumajang_catalog_cache', JSON.stringify(warungs));
      } catch {}
    }

    // Strict A-Z sorting based on uppercase normalized warung name
    return warungs.sort((a, b) =>
      (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' })
    );
  } catch (err) {
    console.error('Fetch warungs failed, trying cached or static catalog:', err);

    // Fallback 1: LocalStorage cache
    try {
      const cached = localStorage.getItem('olumajang_catalog_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a, b) =>
            (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' })
          );
        }
      }
    } catch {}

    // Fallback 2: Static catalog json file
    try {
      const staticRes = await fetch('/data/catalog.json');
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (Array.isArray(staticData.warungs) && staticData.warungs.length > 0) {
          return staticData.warungs.sort((a: Warung, b: Warung) =>
            (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' })
          );
        }
      }
    } catch {}

    throw err;
  }
}

export async function loginAdmin(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await apiFetch('/admin/login', {
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
    const res = await apiFetch('/admin/verify', {
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
      await apiFetch('/admin/logout', {
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
  const res = await apiFetch('/warung', {
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
  const res = await apiFetch(`/warung/${id}`, {
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
  const res = await apiFetch(`/warung/${id}`, {
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

// Logo upload: transmits as high quality data URL or FormData
export async function uploadWarungLogo(warungId: string, file: File): Promise<Warung> {
  const token = getAuthToken();
  const logoDataUrl = await fileToDataUrl(file);

  const res = await apiFetch(`/warung/${warungId}/logo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      logoDataUrl,
      fileName: file.name,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengunggah logo warung.');
  }
  return data.warung;
}

export async function deleteWarungLogo(warungId: string): Promise<Warung> {
  const token = getAuthToken();
  const res = await apiFetch(`/warung/${warungId}/logo`, {
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
  
  // Convert files to Data URLs in parallel
  const photos = await Promise.all(
    files.map(async (file) => ({
      dataUrl: await fileToDataUrl(file),
      fileName: file.name,
    }))
  );

  const res = await apiFetch(`/warung/${warungId}/photos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ photos }),
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
  const res = await apiFetch(`/warung/${warungId}/photos/${photoId}`, {
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
  const res = await apiFetch(`/warung/${warungId}/photos/reorder`, {
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
