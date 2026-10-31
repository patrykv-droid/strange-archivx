export function isThumbnail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 180000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
export async function makeThumbnail(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Wybierz zdjęcie JPG, PNG lub WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Zdjęcie może mieć maksymalnie 10 MB.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Nie można odczytać tego zdjęcia. Wybierz inny plik.'); }
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Przeglądarka nie obsługuje przetwarzania zdjęć.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/webp', 0.8);
    if (!isThumbnail(result)) throw new Error('Zdjęcie jest zbyt duże po zmniejszeniu. Wybierz inne.');
    return result;
  } finally { bitmap.close(); }
}
