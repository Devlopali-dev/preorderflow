import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Toutes les routes sont protégées par défaut (JwtAuthGuard global) —
// @Public() est l'exception explicite, jamais l'inverse. Sécurité par
// défaut plutôt que par oubli (cf. CLAUDE.md §26).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
