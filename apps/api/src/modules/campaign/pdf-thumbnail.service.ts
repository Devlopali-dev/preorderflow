import { Injectable, Logger } from "@nestjs/common";
import { createCanvas } from "@napi-rs/canvas";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// pdfjs-dist v6 est ESM-only : on l'importe en dynamique depuis ce module
// CommonJS. On cible la build `legacy`, seule compatible Node.js (la build
// principale attend un environnement navigateur et échoue au chargement).
// Les polices standard (Helvetica, Times...) sont embarquées dans le paquet ;
// sans `standardFontDataUrl`, un PDF utilisant une telle police lève une
// erreur au rendu.
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

// Résout le dossier racine du paquet pdfjs-dist réellement installé
// (pdfjs-dist est une dépendance directe de l'app api, on en connaît donc
// le chemin via require.resolve). Base pour retrouver les polices standard
// et le worker.
const PDFJS_DIR = dirname(require.resolve("pdfjs-dist/package.json"));

// Génère un aperçu JPEG de la première page d'un PDF et le range à côté du
// fichier d'origine (même dossier, extension .jpg). Retourne le chemin écrit.
@Injectable()
export class PdfThumbnailService {
  private readonly logger = new Logger(PdfThumbnailService.name);

  // Échelle de rendu : 1 page PDF ≈ 72 dpi ; x2 donne une vignette nette
  // (≈144 dpi) pour l'affichage dans la galerie.
  private static readonly SCALE = 2;

  private pdfjs: PdfJs | null = null;

  async generateThumbnail(pdfPath: string, thumbnailPath: string): Promise<string> {
    if (!this.pdfjs) {
      this.pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    }

    const data = new Uint8Array(await readFile(pdfPath));
    const loadingTask = this.pdfjs.getDocument({
      data,
      standardFontDataUrl: pathToFileURL(join(PDFJS_DIR, "standard_fonts", "/")).href,
    });
    const document = await loadingTask.promise;

    try {
      const page = await document.getPage(1);
      const viewport = page.getViewport({ scale: PdfThumbnailService.SCALE });

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      await page.render({
        canvas: null,
        canvasContext: context,
        viewport,
      } as unknown as Parameters<typeof page.render>[0]).promise;

      await writeFile(thumbnailPath, canvas.toBuffer("image/jpeg", 85));
      this.logger.log(`Aperçu PDF généré : ${thumbnailPath}`);
      return thumbnailPath;
    } finally {
      await loadingTask.destroy();
    }
  }
}
