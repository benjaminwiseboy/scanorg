// Jeu de données de démonstration — NE PAS lancer sur une base de production réelle.
//   npm run db:demo -- --yes [--base-url=https://mon-app.vercel.app]
//
// Rejouable : supprime d'abord tout ce qui appartient aux comptes @demo.scanorg.test.
// Les mots de passe sont aléatoires à chaque exécution et écrits dans
// demo-credentials.md (ignoré par Git).
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/prisma";
import { finalize, type Respondent } from "../src/engines/finalize";
import { DIMENSIONS, METHODOLOGY_CODE, QUESTIONS } from "../src/engines/methodology/lf-eac-v1";

const DOMAIN = "demo.scanorg.test"; // inscription bloquée sur ce domaine (src/lib/auth.ts)
const CREDENTIALS_FILE = "demo-credentials.md";
const args = process.argv.slice(2);
const baseUrl = (args.find((a) => a.startsWith("--base-url="))?.split("=")[1] ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ─── Générateur pseudo-aléatoire déterministe (résultats reproductibles) ───
let seed = 20261012;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());

/** Scores cibles par dimension (E1..C3), dans l'ordre de DIMENSIONS. */
type Profile = number[];

/** Réponses d'un répondant fictif autour d'un profil de scores cibles. */
function fakeRespondent(profile: Profile, nspRate = 0.04): Respondent {
  const personal = gauss() * 0.4; // tendance propre au répondant
  return {
    responses: QUESTIONS.map((q) => {
      if (rand() < nspRate) return { questionNumber: q.number, value: null, notApplicable: true };
      const target = 1 + (profile[DIMENSIONS.findIndex((d) => d.code === q.dimension)] / 100) * 4;
      const value = Math.min(5, Math.max(1, Math.round(target + personal + gauss() * 0.7)));
      return { questionNumber: q.number, value, notApplicable: false };
    }),
  };
}

const token = () => randomBytes(24).toString("base64url");

async function main() {
  if (!args.includes("--yes")) {
    const host = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").replace(/\/\/[^@]*@/, "//***@").split("?")[0];
    console.error(`Base ciblée : ${host}\nRelancez avec --yes pour confirmer (les données démo existantes seront remplacées).`);
    process.exit(1);
  }
  const prisma = db();
  const mv = await prisma.methodologyVersion.findUnique({ where: { code: METHODOLOGY_CODE }, include: { questions: true } });
  if (!mv) throw new Error(`${METHODOLOGY_CODE} absent : lancez d'abord npm run db:seed`);
  const qid = new Map(mv.questions.map((q) => [q.number, q.id]));

  // 1. Nettoyage des données démo précédentes
  const old = await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, include: { memberships: true } });
  await prisma.organization.deleteMany({ where: { id: { in: old.flatMap((u) => u.memberships.map((m) => m.organizationId)) } } });
  await prisma.user.deleteMany({ where: { id: { in: old.map((u) => u.id) } } });

  const credentials: { email: string; password: string; org: string; note: string }[] = [];

  async function createAdmin(name: string, email: string, orgName: string, note: string) {
    const password = `Demo-${randomBytes(6).toString("base64url")}`;
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId, name, email, emailVerified: true,
        accounts: { create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(password) } },
      },
    });
    const org = await prisma.organization.create({
      data: { name: orgName, memberships: { create: { userId, role: "ADMIN_ORG" } } },
    });
    credentials.push({ email, password, org: orgName, note });
    return { userId, orgId: org.id };
  }

  /** Crée une campagne : `submitted` profils complets, `partial` à moitié remplis, `invited` liens vierges. */
  async function createCampaign(
    owner: { userId: string; orgId: string },
    name: string,
    opts: { profile: Profile; submitted: number; partial?: number; invited?: number; finalizeIt: boolean },
  ) {
    const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
    const campaign = await prisma.campaign.create({
      data: { organizationId: owner.orgId, methodologyVersionId: mv!.id, name, status: "OPEN", launchedAt: daysAgo(14) },
    });
    const respondents = Array.from({ length: opts.submitted }, () => fakeRespondent(opts.profile));
    const links: string[] = [];

    for (const r of respondents) {
      await prisma.participant.create({
        data: {
          campaignId: campaign.id, token: token(), status: "SUBMITTED", submittedAt: daysAgo(Math.floor(rand() * 10)),
          responses: { createMany: { data: r.responses.map((x) => ({ questionId: qid.get(x.questionNumber)!, value: x.value, notApplicable: x.notApplicable })) } },
        },
      });
    }
    for (let i = 0; i < (opts.partial ?? 0); i++) {
      const t = token();
      links.push(t);
      const r = fakeRespondent(opts.profile).responses.slice(0, 15 + Math.floor(rand() * 15));
      await prisma.participant.create({
        data: {
          campaignId: campaign.id, token: t, status: "IN_PROGRESS",
          responses: { createMany: { data: r.map((x) => ({ questionId: qid.get(x.questionNumber)!, value: x.value, notApplicable: x.notApplicable })) } },
        },
      });
    }
    for (let i = 0; i < (opts.invited ?? 0); i++) {
      const t = token();
      links.push(t);
      await prisma.participant.create({ data: { campaignId: campaign.id, token: t } });
    }

    if (opts.finalizeIt) {
      const payload = finalize({
        invited: opts.submitted + (opts.partial ?? 0) + (opts.invited ?? 0),
        inProgress: opts.partial ?? 0,
        respondents,
        calculatedAt: new Date(),
      });
      await prisma.analysisSnapshot.create({
        data: {
          campaignId: campaign.id, status: payload.status, methodologyVersion: payload.methodologyVersion,
          engineVersion: payload.engineVersion, calculatedAt: new Date(payload.calculatedAt), payload,
        },
      });
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: payload.status === "PUBLISHED" ? "PUBLISHED" : "CLOSED", closedAt: new Date() },
      });
      await prisma.auditEvent.create({
        data: {
          organizationId: owner.orgId, actorId: owner.userId, entityType: "Campaign", entityId: campaign.id,
          type: payload.status === "PUBLISHED" ? "ANALYSIS_PUBLISHED" : "ANALYSIS_BLOCKED", metadata: { demo: true },
        },
      });
      const score = payload.status === "PUBLISHED" && payload.map.global.status === "OK" ? payload.map.global.score : null;
      console.log(`  • ${name} : ${payload.status}${score !== null ? ` — score global ${score}` : ""}`);
    } else {
      console.log(`  • ${name} : OPEN — ${opts.submitted} soumis, ${opts.partial ?? 0} en cours, ${opts.invited ?? 0} vierges`);
    }
    return links;
  }

  // 2. Organisation A — profil proche du jeu Golden 001 « NOVA SERVICES »
  console.log("Nova Services");
  const nova = await createAdmin("Awa Diallo", `admin.nova@${DOMAIN}`, "Nova Services (démo)", "3 campagnes : publiée, bloquée (< 5), en cours");
  await createCampaign(nova, "Mesure initiale — mars 2026", { profile: [66, 62, 57, 50, 44, 46, 45, 38, 42], submitted: 24, invited: 4, finalizeIt: true });
  await createCampaign(nova, "Équipe Direction — test confidentialité", { profile: [70, 65, 60, 55, 50, 50, 50, 45, 45], submitted: 4, invited: 2, finalizeIt: true });
  const openLinks = await createCampaign(nova, "Re-mesure — octobre 2026", { profile: [68, 64, 60, 55, 50, 50, 50, 45, 45], submitted: 3, partial: 2, invited: 7, finalizeIt: false });

  // 3. Organisation B — profil proche du jeu Golden 002 « Organisation solide »
  console.log("Atlas Industries");
  const atlas = await createAdmin("Koffi Mensah", `admin.atlas@${DOMAIN}`, "Atlas Industries (démo)", "1 campagne publiée (organisation solide) — sert aussi à tester l'isolation entre organisations");
  await createCampaign(atlas, "Diagnostic annuel 2026", { profile: [82, 84, 80, 81, 83, 79, 85, 82, 80], submitted: 18, invited: 2, finalizeIt: true });

  // 4. Organisation C — profil « Performance sous tension » (Golden 003)
  console.log("Kora Logistique");
  const kora = await createAdmin("Fatou Ndiaye", `admin.kora@${DOMAIN}`, "Kora Logistique (démo)", "1 campagne publiée (performance sous tension : C3 fragile)");
  await createCampaign(kora, "Mesure T1 2026", { profile: [76, 79, 74, 72, 76, 74, 82, 84, 38], submitted: 12, finalizeIt: true });

  // 5. Restitution des identifiants
  const md = [
    "# Identifiants de démo ScanORG",
    "",
    `Générés le ${new Date().toLocaleString("fr-FR")} pour ${baseUrl}. Fichier local, ignoré par Git.`,
    "",
    "| Email | Mot de passe | Organisation | Contenu |",
    "|---|---|---|---|",
    ...credentials.map((c) => `| ${c.email} | \`${c.password}\` | ${c.org} | ${c.note} |`),
    "",
    "## Liens participant — campagne « Re-mesure — octobre 2026 » (Nova, ouverte)",
    "",
    "Les 2 premiers ont déjà répondu à une partie des questions (test de la reprise) ; les suivants sont vierges.",
    "",
    ...openLinks.map((t, i) => `${i + 1}. ${baseUrl}/scan/${t}`),
    "",
  ].join("\n");
  // Lisible par le seul propriétaire ; les mots de passe ne passent pas par les logs.
  writeFileSync(CREDENTIALS_FILE, md, { mode: 0o600 });
  chmodSync(CREDENTIALS_FILE, 0o600); // si le fichier existait déjà
  console.log(`\n${credentials.length} comptes créés. Identifiants et liens : ${CREDENTIALS_FILE}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
