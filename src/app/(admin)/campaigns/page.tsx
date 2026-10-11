import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { StatusBadge } from "@/components/status";
import { createCampaign } from "@/server/actions";
import { requireMembership } from "@/server/authz";
import { db } from "@/lib/prisma";

export default async function CampaignsPage() {
  const { organization } = await requireMembership();
  const campaigns = await db().campaign.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Campagnes</p>
        <h1 className="mt-1 font-serif text-3xl">Mesurer la vitalité de l'organisation</h1>
      </div>

      <section className="card">
        <h2 className="font-medium">Nouvelle campagne</h2>
        <ActionForm action={createCampaign} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input className="input" name="name" placeholder="Ex. Mesure initiale — octobre 2026" required minLength={2} />
          <SubmitButton className="btn-primary shrink-0" pendingLabel="Création…">Créer</SubmitButton>
        </ActionForm>
      </section>

      {campaigns.length === 0 ? (
        <p className="text-sm text-muted">
          Aucune campagne pour l'instant. Créez-en une, générez des liens de participation, puis lancez-la.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/campaigns/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-surface-2">
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-3 text-sm text-muted">
                  {c._count.participants} lien(s)
                  <StatusBadge status={c.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
