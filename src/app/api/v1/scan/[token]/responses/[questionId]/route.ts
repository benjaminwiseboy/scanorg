import { z } from "zod";
import { db } from "@/lib/prisma";
import { fail, ok, requestId } from "@/server/api";
import { findParticipant } from "@/server/scanner";

// SaveResponseDto (05.2) : value XOR notApplicable.
const SaveResponseDto = z
  .object({
    value: z.number().int().min(1).max(5).optional(),
    notApplicable: z.literal(true).optional(),
  })
  .strict()
  .refine((d) => (d.value !== undefined) !== (d.notApplicable === true), {
    message: "Fournir soit value (1 à 5), soit notApplicable: true",
  });

export async function PUT(req: Request, ctx: { params: Promise<{ token: string; questionId: string }> }) {
  const rid = requestId(req);
  const { token, questionId } = await ctx.params;

  const body = SaveResponseDto.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(rid, 400, "VALIDATION_ERROR", "Réponse invalide", body.error.issues);

  const participant = await findParticipant(token);
  if (!participant) return fail(rid, 404, "NOT_FOUND", "Lien de participation introuvable");
  if (participant.campaign.status !== "OPEN") return fail(rid, 422, "CAMPAIGN_NOT_OPEN", "La campagne n'accepte pas de réponses");
  if (participant.status === "SUBMITTED") return fail(rid, 409, "ALREADY_SUBMITTED", "Les réponses ont déjà été soumises");

  const question = /^[0-9a-f-]{36}$/i.test(questionId)
    ? await db().question.findFirst({
        where: { id: questionId, methodologyVersionId: participant.campaign.methodologyVersionId },
      })
    : null;
  if (!question) return fail(rid, 422, "QUESTION_NOT_IN_METHODOLOGY", "Question hors méthodologie de la campagne");

  const data = { value: body.data.value ?? null, notApplicable: body.data.notApplicable === true };
  await db().$transaction([
    db().response.upsert({
      where: { participantId_questionId: { participantId: participant.id, questionId } },
      create: { participantId: participant.id, questionId, ...data },
      update: data,
    }),
    ...(participant.status === "INVITED"
      ? [db().participant.update({ where: { id: participant.id }, data: { status: "IN_PROGRESS" } })]
      : []),
  ]);

  return ok(rid, { questionId, saved: true });
}
