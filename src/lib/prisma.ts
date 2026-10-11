import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { PrismaClient } from "@/generated/prisma/client";

// Neon (prod/preview) : driver serverless en WebSocket, qui supporte les
// transactions interactives nécessaires à la finalisation atomique.
// Postgres local (dev) : driver pg classique.
function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  if (url.includes("neon.tech")) {
    neonConfig.webSocketConstructor = ws;
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  }
  return new PrismaClient({ adapter: new PrismaPg(url) });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

// Créé au premier usage : `next build` n'a pas besoin de DATABASE_URL.
export function db() {
  return (globalForPrisma.prisma ??= createClient());
}
