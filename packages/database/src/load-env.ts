import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

// Scripts hors API (seed…) : Prisma 7 ne lit plus .env tout seul. Le fichier est à la racine du
// dépôt ; en conteneur les variables sont déjà dans l'environnement.
const rootEnv = resolve(__dirname, "..", "..", "..", ".env");
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  config({ path: rootEnv, quiet: true });
}
