import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { Scanner, type ScanAnswer } from "@/components/scanner";
import { findParticipant } from "@/server/scanner";
import { db } from "@/lib/prisma";

export const metadata: Metadata = { title: "Scanner de Vitalité LF™", robots: { index: false } };

export default async function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const participant = await findParticipant(token);
  if (!participant) notFound();
  const { campaign } = participant;

  if (participant.status === "SUBMITTED") {
    return <Message title="Merci, vos réponses ont été transmises.">Elles ne sont plus modifiables. Vous pouvez fermer cette page.</Message>;
  }
  if (campaign.status === "DRAFT") {
    return <Message title="Cette campagne n'est pas encore ouverte.">Revenez sur ce lien lorsque l'organisation l'aura lancée.</Message>;
  }
  if (campaign.status !== "OPEN") {
    return <Message title="Cette campagne est terminée.">Il n'est plus possible de répondre.</Message>;
  }

  const [questions, responses] = await Promise.all([
    db().question.findMany({
      where: { methodologyVersionId: campaign.methodologyVersionId },
      select: { id: true, number: true, text: true },
      orderBy: { number: "asc" },
    }),
    db().response.findMany({ where: { participantId: participant.id }, select: { questionId: true, value: true, notApplicable: true } }),
  ]);

  const initial: Record<string, ScanAnswer> = {};
  for (const r of responses) initial[r.questionId] = r.notApplicable ? "NSP" : (r.value as ScanAnswer);

  return <Scanner token={token} campaignName={campaign.name} questions={questions} initial={initial} />;
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-12">
      <Brand small />
      <h1 className="mt-6 font-serif text-2xl">{title}</h1>
      <p className="mt-2 text-muted">{children}</p>
    </main>
  );
}
