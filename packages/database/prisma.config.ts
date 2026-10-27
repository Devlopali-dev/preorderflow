import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 ne charge plus .env tout seul. En local le fichier est à la racine du dépôt ; en
// conteneur (Docker, Coolify) les variables sont déjà dans l'environnement et il n'y a pas de .env.
const rootEnv = resolve(__dirname, "..", "..", ".env");
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv, quiet: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
