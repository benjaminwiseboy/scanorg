import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function requireUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session.user;
}

/** Utilisateur + son organisation (le pilote : une organisation par compte). */
export async function requireMembership() {
  const user = await requireUser();
  const membership = await db().membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) redirect("/onboarding");
  return { user, membership, organization: membership.organization };
}

/**
 * Isolation tenant : une campagne n'est lisible que par un membre de son
 * organisation. Hors tenant → 404 (aucune fuite d'existence).
 */
export async function requireCampaign(campaignId: string) {
  const ctx = await requireMembership();
  const isUuid = /^[0-9a-f-]{36}$/i.test(campaignId);
  const campaign = isUuid
    ? await db().campaign.findFirst({
        where: { id: campaignId, organizationId: ctx.organization.id },
      })
    : null;
  if (!campaign) notFound();
  return { ...ctx, campaign };
}
