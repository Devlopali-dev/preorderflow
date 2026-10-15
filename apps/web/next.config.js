const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Version affichée dans l'en-tête admin, lue depuis package.json au build.
  env: { NEXT_PUBLIC_APP_VERSION: require("./package.json").version },
  transpilePackages: ["@preorderflow/ui", "@preorderflow/types"],
  reactStrictMode: true,
  // Sortie autonome pour l'image Docker de production : un serveur minimal avec seulement les fichiers utilisés.
  output: "standalone",
  // La racine du dépôt, pour que le repérage des fichiers inclue les paquets du workspace (ui, types).
  experimental: { outputFileTracingRoot: path.join(__dirname, "../..") },
};

module.exports = nextConfig;
