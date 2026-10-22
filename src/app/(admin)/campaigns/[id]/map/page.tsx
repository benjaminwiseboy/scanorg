import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCampaign } from "@/server/authz";
import { db } from "@/lib/prisma";
import { DIMENSIONS, PILLARS } from "@/engines/methodology/lf-eac-v1";
import type { SnapshotPayload } from "@/engines/finalize";
import type { Band, ScoreResult } from "@/engines/scoring";

const BAND: Record<Band, { label: string; text: string; bg: string }> = {
  SOLIDE: { label: "Solide", text: "text-solide", bg: "bg-solide" },
  A_RENFORCER: { label: "À renforcer", text: "text-renforcer", bg: "bg-renforcer" },
  FRAGILE: { label: "Fragile", text: "text-fragile", bg: "bg-fragile" },
  CRITIQUE: { label: "Critique", text: "text-critique", bg: "bg-critique" },
};

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const pct = (n: number) => `${Math.round(n * 100)} %`;

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await requireCampaign(id);
  const snapshot = await db().analysisSnapshot.findUnique({ where: { campaignId: id } });
  if (!snapshot) notFound();
  const p = snapshot.payload as unknown as SnapshotPayload;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/campaigns/${id}`} className="text-sm text-muted hover:text-ink">← {campaign.name}</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Carte de Vitalité LF™</p>
            <h1 className="mt-1 font-serif text-3xl">{campaign.name}</h1>
          </div>
          {p.status === "PUBLISHED" && (
            <a href={`/api/v1/campaigns/${id}/map/pdf`} download className="btn-ghost">
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
              </svg>
              Télécharger la carte (PDF)
            </a>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          {p.participation.submitted} répondant(s) sur {p.participation.invited} lien(s) · participation {pct(p.participation.rate)} ·
          calculé le {new Date(p.calculatedAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC
        </p>
      </div>

      {p.status === "BLOCKED" ? (
        <section className="card border-renforcer/40 bg-warn-soft">
          <h2 className="font-serif text-xl">Résultat protégé</h2>
          <p className="mt-2 text-sm">
            {p.limitations[0]} Aucun score n'a été calculé ni conservé pour cette campagne.
          </p>
          <p className="mt-2 text-sm text-muted">
            Pour obtenir une lecture, rouvrez la campagne et recueillez davantage de réponses.
          </p>
        </section>
      ) : (
        <>
          <GlobalCard result={p.map.global} />

          <section className="grid gap-4 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.code} className="card space-y-5">
                <div>
                  <p className="eyebrow">Pilier {pillar.code}</p>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <h2 className="font-serif text-xl">{pillar.name}</h2>
                    <ScoreText result={p.map.pillars[pillar.code]} />
                  </div>
                </div>
                {DIMENSIONS.filter((d) => d.pillar === pillar.code).map((d) => (
                  <DimensionBar key={d.code} code={d.code} name={d.name} result={p.map.dimensions[d.code]} />
                ))}
              </div>
            ))}
          </section>

          <Legend />

          <section className="card overflow-x-auto">
            <h2 className="font-medium">Qualité des données</h2>
            <table className="mt-4 w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 font-medium">Dimension</th>
                  <th className="py-2 text-right font-medium">Réponses valides</th>
                  <th className="py-2 text-right font-medium">NSP / NC</th>
                  <th className="py-2 text-right font-medium">Complétude</th>
                  <th className="py-2 text-right font-medium">Dispersion (σ, pts)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {DIMENSIONS.map((d) => {
                  const q = p.quality[d.code];
                  return (
                    <tr key={d.code} className="border-b border-line last:border-0">
                      <td className="py-2"><span className="font-mono text-xs text-muted">{d.code}</span> {d.name}</td>
                      <td className="py-2 text-right">{q.nValid}</td>
                      <td className="py-2 text-right">{q.nNotApplicable}</td>
                      <td className="py-2 text-right">{pct(q.completionRate)}</td>
                      <td className="py-2 text-right">{q.dispersion === null ? "—" : fmt(q.dispersion)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="card">
        <h2 className="font-medium">Limites de lecture</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {p.limitations.map((l) => <li key={l}>{l}</li>)}
          <li>Les configurations, Points de Tension et Leviers ne sont pas encore calculés dans ce pilote.</li>
        </ul>
        <p className="mt-4 font-mono text-xs text-muted">
          Méthodologie {p.methodologyVersion} · moteur {p.engineVersion} · confidentialité {p.confidentiality}
        </p>
      </section>
    </div>
  );
}

function GlobalCard({ result }: { result: ScoreResult }) {
  return (
    <section className="card flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">Score global de vitalité</p>
        {result.status === "OK" ? (
          <p className="mt-1 font-serif text-6xl tabular-nums">{fmt(result.score)}<span className="text-2xl text-muted"> / 100</span></p>
        ) : (
          <p className="mt-2 font-serif text-2xl">Données insuffisantes</p>
        )}
      </div>
      {result.status === "OK" ? (
        <span className={`text-lg font-medium ${BAND[result.band].text}`}>{BAND[result.band].label}</span>
      ) : (
        <p className="max-w-sm text-sm text-muted">{result.reason}. Aucun score n'est estimé à la place.</p>
      )}
    </section>
  );
}

function ScoreText({ result }: { result: ScoreResult }) {
  if (result.status !== "OK") return <span className="text-sm text-muted">Insuffisant</span>;
  return <span className={`font-serif text-2xl tabular-nums ${BAND[result.band].text}`}>{fmt(result.score)}</span>;
}

function DimensionBar({ code, name, result }: { code: string; name: string; result: ScoreResult }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span><span className="font-mono text-xs text-muted">{code}</span> {name}</span>
        {result.status === "OK" ? (
          <span className="tabular-nums">{fmt(result.score)}</span>
        ) : (
          <span className="text-xs text-muted">Données insuffisantes</span>
        )}
      </div>
      <div
        className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={result.status === "OK" ? `${name} : ${fmt(result.score)} sur 100, ${BAND[result.band].label}` : `${name} : données insuffisantes`}
      >
        {result.status === "OK" && (
          <div className={`h-full rounded-full ${BAND[result.band].bg}`} style={{ width: `${Math.max(result.score, 1.5)}%` }} />
        )}
        {[25, 50, 75].map((t) => (
          <span key={t} className="absolute top-0 h-full w-px bg-bg" style={{ left: `${t}%` }} />
        ))}
      </div>
      {result.status === "OK" && <p className={`mt-1 text-xs ${BAND[result.band].text}`}>{BAND[result.band].label}</p>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      {(Object.keys(BAND) as Band[]).map((b) => (
        <span key={b} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${BAND[b].bg}`} />
          {BAND[b].label} {b === "SOLIDE" ? "75–100" : b === "A_RENFORCER" ? "50–74" : b === "FRAGILE" ? "25–49" : "0–24"}
        </span>
      ))}
      <span>· Aides de lecture, pas des verdicts.</span>
    </div>
  );
}
