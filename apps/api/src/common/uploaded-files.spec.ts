import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deleteUploadedFiles,
  UPLOADS_ROOT,
  uploadedFilePath,
  uploadFilename,
} from "./uploaded-files";

describe("uploaded-files", () => {
  it("les fichiers sont cherchés dans apps/api/uploads, quel que soit le dossier de travail", () => {
    // Même dossier que celui servi en statique et que la destination des uploads (main.ts, contrôleurs).
    expect(UPLOADS_ROOT.endsWith(join("apps", "api", "uploads"))).toBe(true);
    expect(uploadedFilePath("/uploads/products/a.png")).toBe(
      join(UPLOADS_ROOT, "products", "a.png"),
    );
    expect(uploadedFilePath("/uploads/campaigns/b.pdf").startsWith(UPLOADS_ROOT)).toBe(true);
  });

  it("supprime le fichier, et un fichier déjà absent n'est pas une erreur", async () => {
    mkdirSync(join(UPLOADS_ROOT, "products"), { recursive: true });
    const name = `unit-${Date.now()}.png`;
    const file = join(UPLOADS_ROOT, "products", name);
    writeFileSync(file, "x");

    await deleteUploadedFiles([`/uploads/products/${name}`]);
    expect(existsSync(file)).toBe(false);
    await expect(deleteUploadedFiles([`/uploads/products/${name}`])).resolves.toBeUndefined();
  });

  it("uploadFilename déduit l'extension du type MIME, jamais du nom du client", () => {
    expect(uploadFilename("image/jpeg")).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(uploadFilename("image/png")).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(uploadFilename("image/webp")).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(uploadFilename("application/pdf")).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(uploadFilename("text/html")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
