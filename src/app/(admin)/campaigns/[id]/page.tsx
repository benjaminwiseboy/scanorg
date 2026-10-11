import Link from "next/link";
import { headers } from "next/headers";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { CopyLinks } from "@/components/copy-links";
import { StatusBadge } from "@/components/status";
import { closeAndFinalize, generateLinks, launchCampaign, reopenCampaign } from "@/server/actions";
import { requireCampaign } from "@/server/authz";
import { db } from "@/lib/prisma";
import { RULES } from "@/engines/rules";

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await requireCampaign(id);
  const [participants, snapshot] = await Promise.all([
    db().participant.findMany({ where: { campaignId: id }, select: { token: true, status: true }, orderBy: { createdAt: "asc" } }),
    db().analysisSnapshot.findUnique({ where: { campaignId: id }, select: { status: true } }),
  ]);
  const submitted = participants.filter((p) => p.status === "SUBMITTED").length;
  const inProgress = participants.filter((p) => p.status === "IN_PROGRESS").length;
  const origin = await baseUrl();
  const canEditLinks = campaign.status === "DRAFT" || campaign.status === "OPEN";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="text-sm text-muted hover:text-ink">← Campagnes</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl">{campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        <p className="mt-1 text-sm text-muted">Méthodologie LF-EAC-V1 · 42 questions · 9 dimensions</p>
      </div>

      {/* Progression : uniquement des agrégats, jamais l'état d'un lien précis */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Liens générés" value={participants.length} />
        <Stat label="En cours" value={inProgress} />
        <Stat
          label="Réponses soumises"
          value={submitted}
          hint={submitted < RULES.minRespondents ? `Minimum ${RULES.minRespondents} pour publier un résultat` : undefined}
        />
      </section>

      {campaign.status === "DRAFT" && (
        <section className="card space-y-4">
          <h2 className="font-medium">Lancer la campagne</h2>
          <p className="text-sm text-muted">Une fois lancée, les liens permettent de répondre. Vous pourrez encore en ajouter.</p>
          <ActionButton action={launchCampaign.bind(null, id)} label="Lancer la campagne" pendingLabel="Lancement…" />
        </section>
      )}

      {canEditLinks && (
        <section className="card space-y-4">
          <h2 className="font-medium">Liens de participation</h2>
          <ActionForm action={generateLinks.bind(null, id)} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="count">Nombre de liens</label>
              <input className="input w-28" id="count" name="count" type="number" min={1} max={200} defaultValue={10} />
            </div>
            <SubmitButton className="btn-ghost" pendingLabel="Génération…">Générer</SubmitButton>
          </ActionForm>
          {participants.length > 0 && <CopyLinks links={participants.map((p) => `${origin}/scan/${p.token}`)} />}
        </section>
      )}

      {campaign.status === "OPEN" && (
        <section className="card space-y-3">
          <h2 className="font-medium">Clôturer et analyser</h2>
          <p className="text-sm text-muted">
            Ferme la campagne puis calcule la Carte de Vitalité. En dessous de {RULES.minRespondents} réponses soumises,
            aucun résultat ne sera affiché, pour protéger les participants.
          </p>
          <ActionButton
            action={closeAndFinalize.bind(null, id)}
            label="Clôturer et calculer"
            pendingLabel="Calcul en cours…"
            confirm="Clôturer la campagne ? Les participants ne pourront plus répondre."
          />
        </section>
      )}

      {campaign.status === "CLOSED" && (
        <section className="card space-y-3 border-renforcer/40 bg-warn-soft">
          <h2 className="font-medium">Campagne fermée, analyse non publiée</h2>
          <p className="text-sm">
            {snapshot?.status === "BLOCKED"
              ? `Seulement ${submitted} réponse(s) soumise(s) : le résultat est bloqué par la règle de confidentialité (minimum ${RULES.minRespondents}).`
              : "Le calcul n'a pas abouti. Aucune conclusion partielle n'a été publiée."}
          </p>
          <div className="flex flex-wrap gap-3">
            {!snapshot && <ActionButton action={closeAndFinalize.bind(null, id)} label="Relancer le calcul" pendingLabel="Calcul…" />}
            <ActionButton action={reopenCampaign.bind(null, id)} label="Rouvrir la campagne" pendingLabel="Réouverture…" variant="ghost" />
            {snapshot && <Link href={`/campaigns/${id}/map`} className="btn-ghost">Voir le détail</Link>}
          </div>
        </section>
      )}

      {campaign.status === "PUBLISHED" && (
        <Link href={`/campaigns/${id}/map`} className="btn-primary">Voir la Carte de Vitalité →</Link>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
