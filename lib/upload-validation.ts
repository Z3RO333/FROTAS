export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_PDF_SIZE = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;

export class UploadValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UploadValidationError";
  }
}

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const IMAGE_MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function imageExtensionFromMime(mime: string): string {
  return IMAGE_MIME_TO_EXTENSION[mime] ?? "jpg";
}

const EXTENSION_TO_SAFE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function safeContentTypeFromExtension(ext: string): string {
  return EXTENSION_TO_SAFE_MIME[ext] ?? "image/jpeg";
}

export function fileFromForm(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

async function checkMagicBytes(file: File): Promise<boolean> {
  const ab = await file.slice(0, 12).arrayBuffer();
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
    throw new UploadValidationError(`${label}: envie uma imagem JPG, PNG, WEBP ou HEIC.`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new UploadValidationError(`${label}: imagem acima de 5 MB.`);
  }
  const validMagic = await checkMagicBytes(file);
  if (!validMagic) {
    throw new UploadValidationError(`${label}: arquivo não é uma imagem válida.`);
  }

  try {
    const sharp = await import("sharp");
    const metadata = await sharp
      .default(Buffer.from(await file.arrayBuffer()), {
        failOn: "warning",
        limitInputPixels: MAX_IMAGE_PIXELS,
        pages: 1,
      })
      .metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
      throw new Error("dimensões inválidas");
    }
  } catch (error) {
    throw new UploadValidationError(
      `${label}: imagem corrompida, animada ou acima do limite de resolução.`,
      { cause: error }
    );
  }
}

export async function sanitizeImageForStorage(
  file: File,
  label: string
): Promise<{ buffer: Buffer; extension: "jpg"; contentType: "image/jpeg" }> {
  await validateImageFile(file, label);
  try {
    const sharp = await import("sharp");
    const buffer = await sharp
      .default(Buffer.from(await file.arrayBuffer()), {
        failOn: "warning",
        limitInputPixels: MAX_IMAGE_PIXELS,
        pages: 1,
      })
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      // A recodificação remove EXIF, GPS, perfis e conteúdo extra por padrão.
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();
    return { buffer, extension: "jpg", contentType: "image/jpeg" };
  } catch (error) {
    throw new UploadValidationError(`${label}: não foi possível higienizar a imagem.`, {
      cause: error,
    });
  }
}

export function validateAggregateFileSize(
  files: Array<File | null | undefined>,
  maxBytes: number,
  label: string
): void {
  const total = files.reduce((sum, file) => sum + (file?.size ?? 0), 0);
  if (total > maxBytes) {
    throw new UploadValidationError(`${label}: total de arquivos acima de ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }
}

async function checkPdfMagicBytes(file: File): Promise<boolean> {
  const ab = await file.slice(0, 5).arrayBuffer();
  if (ab.byteLength < 5) return false;
  const buf = new Uint8Array(ab, 0, 5);
  // PDF: %PDF- => 25 50 44 46 2D
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
}

/**
 * Validação forte de PDF: MIME correto E extensão E magic bytes E tamanho.
 * Cada check é AND, não OR — não confia em valor user-controllable isolado.
 */
export async function validatePdfFile(file: File | null, label: string): Promise<void> {
  if (!file) return;
  if (file.size <= 0) {
    throw new UploadValidationError(`${label}: arquivo vazio.`);
  }
  if (file.size > MAX_PDF_SIZE) {
    throw new UploadValidationError(`${label}: PDF acima de 10 MB.`);
  }
  const mimeOk = file.type === "application/pdf";
  const extOk = file.name.toLowerCase().endsWith(".pdf");
  if (!mimeOk || !extOk) {
    throw new UploadValidationError(`${label}: envie um arquivo PDF.`);
  }
  const magicOk = await checkPdfMagicBytes(file);
  if (!magicOk) {
    throw new UploadValidationError(`${label}: arquivo não é um PDF válido.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1");
  if (!tail.includes("%%EOF")) {
    throw new UploadValidationError(`${label}: PDF incompleto ou corrompido.`);
  }

  const content = bytes.toString("latin1");
  const activeTokens = /\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|RichMedia|XFA)\b/i;
  if (activeTokens.test(content)) {
    throw new UploadValidationError(`${label}: PDF com conteúdo ativo não é permitido.`);
  }
}

export function pendingStorageUrl(file: File | null): string | null {
  if (!file) return null;
  return `pending-private-storage://${encodeURIComponent(file.name)}`;
}
