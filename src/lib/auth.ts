import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./prisma";

// En production Vercel sans BETTER_AUTH_URL, on prend le domaine de prod ;
// l'URL propre au déploiement est aussi acceptée (previews).
const vercel = (host?: string) => (host ? `https://${host}` : undefined);

function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? vercel(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    trustedOrigins: [vercel(process.env.VERCEL_URL), vercel(process.env.VERCEL_BRANCH_URL)].filter((o): o is string => !!o),
    database: prismaAdapter(db(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    rateLimit: { enabled: true, window: 60, max: 30 },
    databaseHooks: {
      user: {
        create: {
          // Domaine réservé au jeu de démo (prisma/demo.ts), qui supprime tout
          // compte de ce domaine : personne ne doit pouvoir s'y inscrire.
          before: async (user) => {
            if (user.email.toLowerCase().endsWith("@demo.scanorg.test")) {
              throw new APIError("BAD_REQUEST", { message: "Ce domaine email est réservé." });
            }
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export const getAuth = () => (instance ??= createAuth());
