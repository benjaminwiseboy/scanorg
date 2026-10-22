import { db } from "@/lib/prisma";
import { fail, requestId } from "@/server/api";
import { findParticipant } from "@/server/scanner";
import { buildScanSheet } from "@/server/scan-sheet";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);

/** Fiche PDF des réponses du participant — disponible une fois les réponses soumises (immuables). */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const rid = requestId(req);
  const { token } = await ctx.params;

  const participant = await findParticipant(token);
  if (!participant) return fail(rid, 404, "NOT_FOUND", "Lien de participation introuvable");
  if (participant.status !== "SUBMITTED" || !participant.submittedAt) {
    return fail(rid, 409, "NOT_SUBMITTED", "La fiche est disponible une fois vos réponses envoyées");
  }

  const [questions, responses] = await Promise.all([
    db().question.findMany({
      where: { methodologyVersionId: participant.campaign.methodologyVersionId },
      select: { id: true, number: true, text: true, dimension: { select: { code: true } } },
      orderBy: { number: "asc" },
    }),
    db().response.findMany({ where: { participantId: participant.id }, select: { questionId: true, value: true, notApplicable: true } }),
  ]);
  const byQuestion = new Map(responses.map((r) => [r.questionId, r]));

  const pdf = await buildScanSheet({
    campaignName: participant.campaign.name,
    submittedAt: participant.submittedAt,
    questions: questions.map((q) => {
      const r = byQuestion.get(q.id);
      return { number: q.number, dimension: q.dimension.code, text: q.text, answer: !r ? null : r.notApplicable ? "NSP" : r.value };
    }),
  });

  const filename = `fiche-scanner-${slug(participant.campaign.name) || "scanorg"}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Request-ID": rid,
    },
  });
}
