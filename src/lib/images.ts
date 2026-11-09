/** Scale dimensions to fit inside max x max, never upscaling. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
/** Client-side resize/compress to JPEG before upload (legacy photos averaged ~3 MB). */
export async function resizeImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const { width, height } = fitWithin(bmp.width, bmp.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not compress image'))), 'image/jpeg', quality));
}
