import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

// Dossier des fichiers uploadés (apps/api/uploads), ancré sur l'emplacement de ce module et non sur
// le dossier de travail : en dev (`src/common`) comme compilé (`dist/common`), il est à deux niveaux
// d'`apps/api`. Avec `process.cwd()`, l'API lancée depuis la racine du dépôt (CI, déploiement)
// cherchait les fichiers au mauvais endroit et ne les supprimait jamais.
export const UPLOADS_ROOT = resolve(__dirname, "..", "..", "uploads");

// Extension déduite du type MIME (déjà filtré par le fileFilter) et non du nom fourni par le
// client : le nom de fichier écrit sur disque ne contient ainsi jamais d'entrée utilisateur.
const UPLOAD_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export function uploadFilename(mimetype: string): string {
  return `${randomUUID()}${UPLOAD_EXTENSIONS[mimetype] ?? ""}`;
}

export function uploadedFilePath(url: string): string {
  return join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ""));
}

// Retire du disque local des fichiers uploadés (images, PDF, vignettes) à partir
// de leur URL publique (`/uploads/...`). Un fichier déjà absent n'est pas une erreur.
export async function deleteUploadedFiles(urls: string[]): Promise<void> {
  await Promise.all(urls.map((url) => unlink(uploadedFilePath(url)).catch(() => undefined)));
}
