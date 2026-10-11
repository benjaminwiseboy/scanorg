# ScanORG™ — Pilote

Pilote du Scanner de Vitalité LF™ (méthodologie **LF-EAC-V1**), réalisé d'après le Build Pack Développeur V4.
Stack : Next.js 16 · Prisma 7 · Neon (PostgreSQL) · Better Auth · Tailwind 4 · Vercel.

## Périmètre du pilote

Étapes 1 à 7 du Build Pack (16.1), soit l'équivalent du plan **SCANORG_FREE** :

| Inclus | Pas encore inclus |
|---|---|
| Seed LF-EAC-V1 : 42 questions exactes, versionnées et immuables | Configurations, Tensions, Leviers |
| Comptes admin (email + mot de passe), une organisation par compte | Priorités, prescriptions, expérimentations |
| Campagne : brouillon → lancement → clôture → analyse | Segmentation (départements/équipes) et anti-reconstruction |
| Liens de participation non nominatifs | Re-Scan, trajectoire |
| Scanner 9 étapes, échelle 1–5 + NSP/NC, enregistrement progressif, reprise, revue, soumission immuable | Abonnement, paiement, exports, rapports |
| Moteurs Scoring, Qualité, Confidentialité (seuil 5) et Carte de Vitalité | Rôle Praticien, invitations de membres |
| Snapshot d'analyse immuable (méthodologie + version moteur) et journal d'audit | Idempotency-Key, rate limiting sur l'API scanner |

## Architecture

```
src/engines/     Moteurs en TypeScript pur, sans dépendance à Next ni à Prisma
  methodology/   Référentiel LF-EAC-V1 (source unique pour le seed et les calculs)
  scoring.ts     07.1 : 1→0 … 5→100, minimum 3 réponses, bandes
  quality.ts     07.2 : n valides, NSP, complétude, dispersion
  confidentiality.ts  08 : minimum 5 répondants
  finalize.ts    05.3 : pipeline validate → quality → scoring → confidentiality → map
src/server/      Autorisation (isolation tenant), server actions admin, helpers API
src/app/api/v1/  API REST du scanner (enveloppe { data, meta.requestId })
prisma/          Schéma, migration (avec CHECK value XOR NSP), seed
tests/           Tests des moteurs (frontières 14.3 et tests négatifs)
```

## Lancer en local

```bash
npm install
npx prisma dev -n scanorg -d           # Postgres local (ou utilisez une branche Neon)
cp .env.example .env                    # puis renseignez DATABASE_URL et BETTER_AUTH_SECRET
npx prisma migrate deploy && npm run db:seed
npm run dev                             # http://localhost:3000
npm test                                # tests des moteurs
```

Pour `prisma dev`, l'URL TCP s'affiche au démarrage (`postgres://postgres:postgres@localhost:5121x/template1?sslmode=disable`).

## Déployer sur Vercel + Neon

1. **Poussez le dépôt sur GitHub**, puis importez-le dans Vercel (*Add New → Project*).
2. **Base de données** : dans Vercel, onglet *Storage → Create → Neon*. Choisissez la région **Frankfurt (eu-central-1)**.
   L'intégration injecte `DATABASE_URL` (poolée) et `DATABASE_URL_UNPOOLED` (directe), qui sont toutes deux reconnues.
   *Si vous créez la base sur neon.tech plutôt que via Vercel, ajoutez vous-même `DATABASE_URL` (chaîne « pooled ») et `DIRECT_URL` (chaîne directe).*
3. **Variables d'environnement** (*Settings → Environment Variables*) :
   - `BETTER_AUTH_SECRET` : générez une valeur avec `openssl rand -base64 32`.
   - `BETTER_AUTH_URL` : facultatif. Par défaut, c'est le domaine de production Vercel qui est utilisé.
4. **Déployez.** Le script `vercel-build` exécute `prisma migrate deploy` puis le seed (idempotent), puis `next build`.
   Les fonctions tournent en `fra1` (voir `vercel.json`).
5. **Testez** : `/register` → créer l'organisation → créer une campagne → générer des liens → lancer.
   Ouvrez les liens en navigation privée pour répondre, puis faites *Clôturer et calculer*.
   Avec moins de 5 réponses, le résultat est volontairement bloqué. *Rouvrir la campagne* permet alors d'en recueillir davantage.

En production, désactivez la mise en veille (*scale to zero*) du compute Neon pour éviter les démarrages à froid.

## Hypothèses du pilote à faire valider

Le Build Pack interdit d'interpréter une règle absente. Les points ci-dessous sont des choix **provisoires** :

1. **Libellés des dimensions** (Identité, Cap & alignement…) : ils sont déduits des configurations 07.6, car le document ne les nomme pas.
2. **Score d'une dimension** : moyenne de toutes les réponses valides regroupées de tous les répondants (08.3). Le minimum de 3 réponses s'applique à ce niveau agrégé.
3. **Pilier et global** : si une dimension est INSUFFICIENT_DATA, le pilier et le score global le sont aussi. Il n'y a aucune substitution.
4. **Seuil de 5 répondants** : il est appliqué aussi au résultat organisationnel complet (jeu Golden 009), pas seulement aux segments.
5. **Dispersion** : calculée (écart-type en points), mais **non qualifiée**. Le seuil « HIGH » n'est pas défini et le niveau affiché est donc TO_VERIFY.
6. **Ancrage de l'échelle** : « 1 = pas du tout d'accord · 5 = tout à fait d'accord ». Le document dit seulement « 1 à 5 ».
7. **Soumission** : les 42 questions doivent avoir une réponse (NSP/NC compte comme réponse).
8. **Arrondis** : 2 décimales à chaque niveau (dimension, pilier, global). Les bandes sont calculées sur la valeur arrondie.
9. **Suivi admin** : l'administrateur voit uniquement des agrégats (liens, en cours, soumis), jamais le statut d'un lien précis.
