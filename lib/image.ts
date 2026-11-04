/** Resizes a chosen photo in the browser to a small square JPEG, so uploads stay tiny and fast. */
export const PHOTO_SIZE = 384;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export async function prepareProfilePhoto(file: File): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }> {
  if (!ACCEPTED.includes(file.type)) return { ok: false, error: "Use a JPEG, PNG or WebP photo." };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, error: "That photo is too large. Choose one under 12 MB." };
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PHOTO_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, error: "Your browser can't process photos." };
    // Centre-crop to a square, then scale down.
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? { ok: true, blob } : { ok: false, error: "Couldn't process that photo. Try another." };
  } catch {
    return { ok: false, error: "Couldn't read that photo. Try another." };
  }
}
