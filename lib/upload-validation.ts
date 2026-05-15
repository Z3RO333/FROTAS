export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function fileFromForm(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

async function checkMagicBytes(file: File): Promise<boolean> {
  const ab = await file.arrayBuffer();
  const buf = new Uint8Array(ab, 0, Math.min(12, ab.byteLength));
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WEBP: RIFF????WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  // HEIC/HEIF: ftyp box (bytes 4-7 = "ftyp")
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;
  return false;
}

export async function validateImageFile(file: File | null, label: string): Promise<void> {
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${label}: envie uma imagem JPG, PNG, WEBP ou HEIC.`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`${label}: imagem acima de 5 MB.`);
  }
  const validMagic = await checkMagicBytes(file);
  if (!validMagic) {
    throw new Error(`${label}: arquivo não é uma imagem válida.`);
  }
}

export function pendingStorageUrl(file: File | null): string | null {
  if (!file) return null;
  return `pending-private-storage://${encodeURIComponent(file.name)}`;
}
