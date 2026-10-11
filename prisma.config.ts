import "dotenv/config";
import { defineConfig } from "prisma/config";

// Les migrations passent par la connexion directe (DIRECT_URL) ; l'app utilise
// la connexion poolée (DATABASE_URL). L'intégration Neon ↔ Vercel fournit
// DATABASE_URL_UNPOOLED, utilisée automatiquement. En local, peut être omise.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
