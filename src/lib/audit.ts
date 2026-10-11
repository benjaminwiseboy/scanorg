import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// Ne jamais mettre de réponse individuelle ni de secret dans metadata.
export function audit(
  tx: Tx,
  e: { organizationId?: string; actorId?: string | null; type: string; entityType: string; entityId: string; metadata?: Prisma.InputJsonValue },
) {
  return tx.auditEvent.create({ data: { ...e, actorId: e.actorId ?? null } });
}
