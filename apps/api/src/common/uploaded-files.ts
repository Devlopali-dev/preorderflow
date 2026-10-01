import { unlink } from "node:fs/promises";
import { join } from "node:path";

// Retire du disque local des fichiers uploadés (images, PDF, vignettes) à partir
// de leur URL publique (`/uploads/...`). Un fichier déjà absent n'est pas une erreur.
export async function deleteUploadedFiles(urls: string[]): Promise<void> {
  const files = urls.map((url) => join(process.cwd(), "uploads", url.replace(/^\/uploads\//, "")));
  await Promise.all(files.map((file) => unlink(file).catch(() => undefined)));
}
