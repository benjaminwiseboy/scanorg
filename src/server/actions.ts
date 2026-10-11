"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireCampaign, requireMembership, requireUser } from "./authz";
import { finalize, type Respondent } from "@/engines/finalize";
import { METHODOLOGY_CODE } from "@/engines/methodology/lf-eac-v1";

export type ActionState = { error?: string; ok?: string } | undefined;

const name = z.string().trim().min(2, "2 caractères minimum").max(120);

export async function createOrganization(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = name.safeParse(form.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (await db().membership.findFirst({ where: { userId: user.id } })) redirect("/campaigns");

  await db().$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: parsed.data } });
    await tx.membership.create({ data: { organizationId: org.id, userId: user.id, role: "ADMIN_ORG" } });
    await audit(tx, { organizationId: org.id, actorId: user.id, type: "ORG_CREATED", entityType: "Organization", entityId: org.id });
  });
  redirect("/campaigns");
}

export async function createCampaign(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, membership, organization } = await requireMembership();
  if (membership.role !== "ADMIN_ORG") return { error: "Action réservée à l'administrateur de l'organisation." };
  const parsed = name.safeParse(form.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const mv = await db().methodologyVersion.findUnique({ where: { code: METHODOLOGY_CODE } });
  if (!mv) return { error: `Méthodologie ${METHODOLOGY_CODE} absente : lancer le seed.` };

  const campaign = await db().$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: { organizationId: organization.id, methodologyVersionId: mv.id, name: parsed.data },
    });
    await audit(tx, { organizationId: organization.id, actorId: user.id, type: "CAMPAIGN_CREATED", entityType: "Campaign", entityId: c.id });
    return c;
  });
  redirect(`/campaigns/${campaign.id}`);
}

export async function generateLinks(campaignId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { user, campaign } = await requireCampaign(campaignId);
  if (campaign.status !== "DRAFT" && campaign.status !== "OPEN") return { error: "La campagne est fermée." };
  const n = z.coerce.number().int().min(1).max(200).safeParse(form.get("count"));
  if (!n.success) return { error: "Entre 1 et 200 liens par lot." };

  await db().$transaction(async (tx) => {
    await tx.participant.createMany({
      data: Array.from({ length: n.data }, () => ({ campaignId, token: randomBytes(24).toString("base64url") })),
    });
    await audit(tx, {
      organizationId: campaign.organizationId, actorId: user.id, type: "PARTICIPANT_LINKS_CREATED",
      entityType: "Campaign", entityId: campaignId, metadata: { count: n.data },
    });
  });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: `${n.data} lien(s) créé(s).` };
}

export async function launchCampaign(campaignId: string): Promise<ActionState> {
  const { user, campaign } = await requireCampaign(campaignId);
  if (campaign.status !== "DRAFT") return { error: "Seule une campagne en brouillon peut être lancée." };
  const count = await db().participant.count({ where: { campaignId } });
  if (count === 0) return { error: "Générez au moins un lien de participation avant de lancer." };

  await db().$transaction(async (tx) => {
    await tx.campaign.update({ where: { id: campaignId }, data: { status: "OPEN", launchedAt: new Date() } });
    await audit(tx, { organizationId: campaign.organizationId, actorId: user.id, type: "CAMPAIGN_LAUNCHED", entityType: "Campaign", entityId: campaignId });
  });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: "Campagne lancée." };
}

/**
 * Ferme la campagne puis exécute la chaîne de finalisation (05.3). Un échec
 * moteur laisse la campagne CLOSED sans snapshot : aucune conclusion partielle.
 */
export async function closeAndFinalize(campaignId: string): Promise<ActionState> {
  const { user, campaign } = await requireCampaign(campaignId);
  if (campaign.status !== "OPEN" && campaign.status !== "CLOSED") return { error: "Campagne non finalisable dans cet état." };
  if (await db().analysisSnapshot.findUnique({ where: { campaignId } })) return { error: "Une analyse existe déjà pour cette campagne." };

  if (campaign.status === "OPEN") {
    await db().$transaction(async (tx) => {
      await tx.campaign.update({ where: { id: campaignId }, data: { status: "CLOSED", closedAt: new Date() } });
      await audit(tx, { organizationId: campaign.organizationId, actorId: user.id, type: "CAMPAIGN_CLOSED", entityType: "Campaign", entityId: campaignId });
    });
  }

  const participants = await db().participant.findMany({
    where: { campaignId },
    select: {
      status: true,
      responses: { select: { value: true, notApplicable: true, question: { select: { number: true } } } },
    },
  });
  const respondents: Respondent[] = participants
    .filter((p) => p.status === "SUBMITTED")
    .map((p) => ({
      responses: p.responses.map((r) => ({ questionNumber: r.question.number, value: r.value, notApplicable: r.notApplicable })),
    }));

  let payload;
  try {
    payload = finalize({
      invited: participants.length,
      inProgress: participants.filter((p) => p.status === "IN_PROGRESS").length,
      respondents,
      calculatedAt: new Date(),
    });
  } catch (e) {
    await db().$transaction((tx) =>
      audit(tx, {
        organizationId: campaign.organizationId, actorId: user.id, type: "FINALIZE_FAILED", entityType: "Campaign", entityId: campaignId,
        metadata: { reason: e instanceof Error ? e.message : "unknown" },
      }),
    );
    revalidatePath(`/campaigns/${campaignId}`);
    return { error: "Le calcul a échoué : aucune analyse n'a été publiée. Réessayez ou contactez le support." };
  }

  await db().$transaction(async (tx) => {
    await tx.analysisSnapshot.create({
      data: {
        campaignId,
        status: payload.status,
        methodologyVersion: payload.methodologyVersion,
        engineVersion: payload.engineVersion,
        calculatedAt: new Date(payload.calculatedAt),
        payload,
      },
    });
    if (payload.status === "PUBLISHED") {
      await tx.campaign.update({ where: { id: campaignId }, data: { status: "PUBLISHED" } });
    }
    await audit(tx, {
      organizationId: campaign.organizationId, actorId: user.id,
      type: payload.status === "PUBLISHED" ? "ANALYSIS_PUBLISHED" : "ANALYSIS_BLOCKED",
      entityType: "Campaign", entityId: campaignId,
      metadata: { engineVersion: payload.engineVersion, respondents: payload.participation.submitted },
    });
  });

  redirect(`/campaigns/${campaignId}/map`);
}

/** Rouvre une campagne fermée non publiée (ex. bloquée pour < 5 répondants). */
export async function reopenCampaign(campaignId: string): Promise<ActionState> {
  const { user, campaign } = await requireCampaign(campaignId);
  if (campaign.status !== "CLOSED") return { error: "Seule une campagne fermée et non publiée peut être rouverte." };

  await db().$transaction(async (tx) => {
    // Un snapshot BLOCKED ne contient aucun score et n'a jamais été publié.
    await tx.analysisSnapshot.deleteMany({ where: { campaignId, status: "BLOCKED" } });
    await tx.campaign.update({ where: { id: campaignId }, data: { status: "OPEN", closedAt: null } });
    await audit(tx, { organizationId: campaign.organizationId, actorId: user.id, type: "CAMPAIGN_REOPENED", entityType: "Campaign", entityId: campaignId });
  });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: "Campagne rouverte." };
}
