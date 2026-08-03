import { describe, expect, it } from "vitest";
import { UploadValidationError, validateImageFile, validatePdfFile } from "./upload-validation";

describe("upload validation", () => {
  it("aceita PNG com assinatura válida", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    const file = new File([png], "painel.png", { type: "image/png" });
    await expect(validateImageFile(file, "Foto")).resolves.toBeUndefined();
  });

  it("rejeita MIME de imagem com conteúdo falso", async () => {
    const file = new File(["não é imagem"], "painel.png", { type: "image/png" });
    await expect(validateImageFile(file, "Foto")).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejeita extensão PDF com conteúdo falso", async () => {
    const file = new File(["conteúdo"], "documento.pdf", { type: "application/pdf" });
    await expect(validatePdfFile(file, "Documento")).rejects.toThrow("PDF válido");
  });

  it("aceita PDF com magic bytes", async () => {
    const file = new File(["%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"], "documento.pdf", { type: "application/pdf" });
    await expect(validatePdfFile(file, "Documento")).resolves.toBeUndefined();
  });

  it("rejeita PDF com JavaScript", async () => {
    const file = new File(
      ["%PDF-1.7\n1 0 obj<</OpenAction<</S/JavaScript/JS(alert(1))>>>>endobj\n%%EOF\n"],
      "documento.pdf",
      { type: "application/pdf" }
    );
    await expect(validatePdfFile(file, "Documento")).rejects.toThrow("conteúdo ativo");
  });
});
