import { getAuth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { fail, requestId } from "@/server/api";
import { buildMapPdf } from "@/server/map-pdf";
import { slug } from "@/server/pdf";
import type { SnapshotPayload } from "@/engines/finalize";

/** Export PDF de la Carte de Vitalité — mêmes règles d'accès et de confidentialité que l'écran. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  const { id } = await ctx.params;

  const session = await getAuth().api.getSession({ headers: req.headers });
  if (!session) return fail(rid, 401, "UNAUTHENTICATED", "Connexion requise");

  // Isolation tenant : hors organisation → 404, sans révéler l'existence de la campagne.
  const campaign = /^[0-9a-f-]{36}$/i.test(id)
    ? await db().campaign.findFirst({
        where: { id, organization: { memberships: { some: { userId: session.user.id } } } },
        include: { organization: { select: { name: true } }, snapshot: true },
      })
    : null;
  if (!campaign) return fail(rid, 404, "NOT_FOUND", "Campagne introuvable");

  const payload = campaign.snapshot?.payload as unknown as SnapshotPayload | undefined;
  if (!payload || payload.status !== "PUBLISHED") {
    return fail(rid, 409, "NOT_EXPORTABLE", "Aucune carte publiée pour cette campagne (résultat absent ou protégé)");
  }

  const generatedAt = new Date();
  const pdf = await buildMapPdf({
    organizationName: campaign.organization.name,
    campaignName: campaign.name,
    snapshot: payload,
    generatedAt,
  });

  await db().$transaction((tx) =>
    audit(tx, {
      organizationId: campaign.organizationId, actorId: session.user.id, type: "MAP_EXPORTED",
      entityType: "Campaign", entityId: campaign.id, metadata: { format: "pdf", engineVersion: payload.engineVersion },
    }),
  );

  const filename = `carte-vitalite-${slug(campaign.name) || "scanorg"}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Request-ID": rid,
    },
  });
}
