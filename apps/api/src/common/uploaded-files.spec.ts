import { describe, expect, it } from "vitest";
import { uploadFilename } from "./uploaded-files";

describe("uploadFilename", () => {
  it("déduit l'extension du type MIME, jamais du nom du client", () => {
    expect(uploadFilename("image/jpeg")).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(uploadFilename("image/png")).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(uploadFilename("image/webp")).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(uploadFilename("application/pdf")).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("n'ajoute aucune extension pour un type inconnu", () => {
    expect(uploadFilename("text/html")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
