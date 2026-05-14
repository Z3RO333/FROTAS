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

export function validateImageFile(file: File | null, label: string): void {
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${label}: envie uma imagem JPG, PNG, WEBP ou HEIC.`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`${label}: imagem acima de 5 MB.`);
  }
}

export function pendingStorageUrl(file: File | null): string | null {
  if (!file) return null;
  return `pending-private-storage://${encodeURIComponent(file.name)}`;
}
