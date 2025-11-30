/**
 * Client-side image resize helper.
 * - Loads an image File/Blob into a canvas
 * - Resizes to fit within maxWidth x maxHeight while preserving aspect ratio
 * - Exports a compressed Blob (JPEG by default) with the requested quality
 */
export type ResizeOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for toBlob
  mimeType?: string; // e.g. 'image/jpeg' or 'image/webp'
};

function browserSupportsWebP(): boolean {
  try {
    const cvs = document.createElement('canvas');
    return cvs.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
}

async function imageHasAlpha(img: HTMLImageElement): Promise<boolean> {
  // Draw scaled-down sample to detect transparency without allocating huge arrays
  const sampleSize = 64;
  const cvs = document.createElement('canvas');
  cvs.width = sampleSize;
  cvs.height = sampleSize;
  const ctx = cvs.getContext('2d');
  if (!ctx) return false;

  // draw the image scaled to the sample canvas
  try {
    ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
    const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
    // check alpha channel for any pixel < 255
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  } catch {
    // If cross-origin or other error, assume no alpha to avoid forcing PNG
    return false;
  }
  return false;
}

export async function resizeImageFile(file: File | Blob, opts: ResizeOptions = {}): Promise<File> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = opts;
  const preferredMime = opts.mimeType;

  // Quick path: if file is already small, return as File
  try {
    if (file instanceof File && file.size <= 300 * 1024) {
      return file;
    }
  } catch {
    // ignore
  }

  // Create an image element to load the blob
  const img = document.createElement('img');
  const url = URL.createObjectURL(file as Blob);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });

  // Compute target dimensions preserving aspect ratio
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  let targetW = origW;
  let targetH = origH;
  const ratio = origW / origH;

  if (origW > maxWidth || origH > maxHeight) {
    if (ratio >= 1) {
      // landscape or square
      targetW = Math.min(maxWidth, origW);
      targetH = Math.round(targetW / ratio);
      if (targetH > maxHeight) {
        targetH = maxHeight;
        targetW = Math.round(targetH * ratio);
      }
    } else {
      // portrait
      targetH = Math.min(maxHeight, origH);
      targetW = Math.round(targetH * ratio);
      if (targetW > maxWidth) {
        targetW = maxWidth;
        targetH = Math.round(targetW / ratio);
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetW);
  canvas.height = Math.max(1, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');

  // Decide output mime type dynamically:
  // - If caller provided mime, use it
  // - Otherwise, detect transparency: if image has alpha prefer WebP (if supported) or PNG
  // - For opaque images prefer WebP (if supported) else JPEG
  let mimeType: string;
  if (preferredMime) {
    mimeType = preferredMime;
  } else {
    const hasAlpha = await imageHasAlpha(img);
    const webp = browserSupportsWebP();
    if (hasAlpha) {
      mimeType = webp ? 'image/webp' : 'image/png';
    } else {
      mimeType = webp ? 'image/webp' : 'image/jpeg';
    }
  }

  // Fill background only when producing JPEG (to avoid black for transparent PNGs/WebP)
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // cleanup image object URL
  try {
    URL.revokeObjectURL(url);
  } catch {}

  // Convert canvas to Blob
  const blob: Blob | null = await new Promise((resolve) => {
    // prefer toBlob
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), mimeType, quality);
    } else {
      // fallback: dataURL -> blob
      const data = canvas.toDataURL(mimeType, quality);
      // convert base64 to blob
      const arr = data.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      resolve(new Blob([u8arr], { type: mime }));
    }
  });

  if (!blob) throw new Error('Failed to create resized image blob');

  // If resized blob is larger than original, prefer original to avoid regressions
  try {
    if (file instanceof File && blob.size >= file.size) {
      return file;
    }
  } catch {
    // ignore
  }

  // Create a File using the same base name but with an appropriate extension
  const ext = blob.type === 'image/webp' ? '.webp' : blob.type === 'image/jpeg' ? '.jpg' : '.bin';
  const fileName = (file instanceof File && file.name) ? file.name.replace(/\.[^.]+$/, ext) : `resized-${Date.now()}${ext}`;
  const outFile = new File([blob], fileName, { type: blob.type, lastModified: Date.now() });
  return outFile;
}

export default resizeImageFile;
