import { db } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { fail, ok, requestId } from "@/server/api";
import { findParticipant } from "@/server/scanner";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const rid = requestId(req);
  const { token } = await ctx.params;

  const participant = await findParticipant(token);
  if (!participant) return fail(rid, 404, "NOT_FOUND", "Lien de participation introuvable");
  // Transition déjà appliquée → résultat idempotent (06.3).
  if (participant.status === "SUBMITTED") return ok(rid, { status: "SUBMITTED", submittedAt: participant.submittedAt });
  if (participant.campaign.status !== "OPEN") return fail(rid, 422, "CAMPAIGN_NOT_OPEN", "La campagne n'accepte plus de réponses");

  const [answered, total] = await Promise.all([
    db().response.count({ where: { participantId: participant.id } }),
    db().question.count({ where: { methodologyVersionId: participant.campaign.methodologyVersionId } }),
  ]);
  if (answered < total) {
    return fail(rid, 422, "INCOMPLETE", `${total - answered} question(s) sans réponse`, { answered, total });
  }

  const submittedAt = new Date();
  await db().$transaction(async (tx) => {
    // Garde de concurrence : ne soumet que si le statut n'a pas changé entre-temps.
    const res = await tx.participant.updateMany({
      where: { id: participant.id, status: { not: "SUBMITTED" } },
      data: { status: "SUBMITTED", submittedAt },
    });
    if (res.count === 1) {
      await audit(tx, {
        organizationId: participant.campaign.organizationId,
        type: "SCAN_SUBMITTED",
        entityType: "Campaign",
        entityId: participant.campaign.id,
      });
    }
  });

  return ok(rid, { status: "SUBMITTED", submittedAt });
}
