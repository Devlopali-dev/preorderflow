import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    // Prisma 7 construit son adaptateur dès l'import de @preorderflow/database (avant, la connexion
    // était paresseuse) : sans URL, les tests qui importent l'API planteraient. Ces tests ne
    // joignent pas la base ; l'URL réelle (CI, .env) l'emporte si elle est définie.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test?schema=public",
    },
  },
});
