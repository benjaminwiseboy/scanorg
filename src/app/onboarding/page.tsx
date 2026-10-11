import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Brand } from "@/components/brand";
import { createOrganization } from "@/server/actions";
import { requireUser } from "@/server/authz";
import { db } from "@/lib/prisma";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await db().membership.findFirst({ where: { userId: user.id } })) redirect("/campaigns");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Brand />
      <div className="card mt-8">
        <p className="eyebrow">Étape 1</p>
        <h1 className="mt-1 font-serif text-xl">Votre organisation</h1>
        <p className="mt-2 text-sm text-muted">
          La licence et les données appartiennent à l'organisation. Vous en serez l'administrateur.
        </p>
        <ActionForm action={createOrganization} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="name">Nom de l'organisation</label>
            <input className="input" id="name" name="name" required minLength={2} maxLength={120} />
          </div>
          <SubmitButton className="btn-primary w-full" pendingLabel="Création…">Créer l'organisation</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
