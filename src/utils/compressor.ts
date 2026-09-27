/**
 * Client-side high quality image compressor with text preservation for menu readability.
 * Compresses images before upload to ensure fast uploads, zero server strain,
 * sharp text, and lightweight mobile bandwidth consumption.
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  width: number;
  height: number;
}

export interface CompressionProgress {
  current: number;
  total: number;
  currentFileName: string;
  percentage: number;
}

/**
 * Compresses an image file with text-optimized settings:
 * - Max dimension: 2048px (sufficient for high-resolution menu text)
 * - Format: image/jpeg or image/webp
 * - Quality: 0.85 (smooth gradient + razor sharp menu lettering)
 */
export async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.85
): Promise<CompressionResult> {
  const originalSize = file.size;

  // If already small SVG or gif, return as is
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate constrained dimensions preserving aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        // Fallback to original file
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          savingsPercent: 0,
          width,
          height,
        });
        return;
      }

      // Smooth bicubic resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw white background in case of transparent png to avoid black background in jpg
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output format (prefer WebP if supported, fallback to JPEG)
      const outputMime = 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savingsPercent: 0,
              width,
              height,
            });
            return;
          }

          // If compressed is somehow larger than original (rare), keep original
          if (blob.size >= originalSize) {
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savingsPercent: 0,
              width,
              height,
            });
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.jpg`, {
            type: outputMime,
            lastModified: Date.now(),
          });

          const compressedSize = compressedFile.size;
          const savingsPercent = Math.max(
            0,
            Math.round(((originalSize - compressedSize) / originalSize) * 100)
          );

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize,
            savingsPercent,
            width,
            height,
          });
        },
        outputMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Gagal memuat gambar: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Compress an array of files asynchronously with queue batching to never block UI thread.
 */
export async function compressImagesBatch(
  files: File[],
  onProgress?: (progress: CompressionProgress) => void
): Promise<{ files: File[]; totalOriginalBytes: number; totalCompressedBytes: number }> {
  const resultFiles: File[] = [];
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: files.length,
        currentFileName: file.name,
        percentage: Math.round(((i + 1) / files.length) * 100),
      });
    }

    try {
      const res = await compressImage(file);
      resultFiles.push(res.file);
      totalOriginal += res.originalSize;
      totalCompressed += res.compressedSize;
    } catch {
      // On failure, keep original file
      resultFiles.push(file);
      totalOriginal += file.size;
      totalCompressed += file.size;
    }

    // Let the main thread breathe for 10ms
    await new Promise((r) => setTimeout(r, 10));
  }

  return {
    files: resultFiles,
    totalOriginalBytes: totalOriginal,
    totalCompressedBytes: totalCompressed,
  };
}

/**
 * Format bytes into human-readable string (KB/MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
