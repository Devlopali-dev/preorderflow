import { execSync } from "node:child_process";
import path from "node:path";

// Nettoyage de fin de suite : les tests créent leurs produits, campagnes, clients et commandes
// sans les supprimer, et la base de dev grossissait à chaque passage (centaines de produits,
// pages et appels de plus en plus lents, tests qui dépassent leur délai).
//
// Le script (packages/database/prisma/clean-e2e.ts) ne supprime que les données de test
// reconnaissables ; le jeu de démo et les données réelles sont épargnés.
//
// `E2E_KEEP_DATA=1` garde les données (pour inspecter la base après un échec).
// Un échec du nettoyage ne fait jamais échouer la suite.
export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_KEEP_DATA === "1") {
    console.log("E2E_KEEP_DATA=1 : données de test conservées.");
    return;
  }
  const repoRoot = path.resolve(__dirname, "../../..");
  try {
    execSync("pnpm --silent --filter @preorderflow/database clean:e2e", {
      cwd: repoRoot,
      stdio: ["ignore", "inherit", "inherit"],
      timeout: 120_000,
    });
  } catch (error) {
    console.warn(
      `Nettoyage des données de test impossible : ${(error as Error).message}. ` +
        "Relancer avec `pnpm db:clean-e2e`.",
    );
  }
}
