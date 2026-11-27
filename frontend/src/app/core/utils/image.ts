/** Reads an image file and returns a resized data URL that fits within maxW × maxH (keeps PNG transparency when small enough). */
export async function resizeImage(file: File, maxW: number, maxH: number, maxBytes = 400_000): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif|bmp|svg\+xml)$/.test(file.type)) throw new Error('Choose a PNG, JPG or WEBP image.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file could not be read as an image.'));
      i.src = url;
    });
    const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/png');
    if (data.length > maxBytes) {
      data = canvas.toDataURL('image/webp', 0.9);
      // Browsers without WEBP encoding fall back to PNG here; use JPEG then.
      if (!data.startsWith('data:image/webp') || data.length > maxBytes) data = canvas.toDataURL('image/jpeg', 0.85);
    }
    if (data.length > maxBytes) throw new Error('The image is too large even after resizing. Try a simpler or smaller image.');
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
