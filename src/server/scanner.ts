import "server-only";
import { db } from "@/lib/prisma";

/** Charge un participant par son jeton de lien, avec sa campagne. */
export async function findParticipant(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return db().participant.findUnique({
    where: { token },
    include: { campaign: { select: { id: true, name: true, status: true, methodologyVersionId: true, organizationId: true } } },
  });
}
