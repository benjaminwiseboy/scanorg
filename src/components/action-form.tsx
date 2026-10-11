"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/actions";

/** Formulaire branché sur une server action, avec retour d'erreur/succès. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <div>
      <form action={formAction} className={className}>
        {children}
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Bouton de soumission qui reflète l'état « en cours » du formulaire parent. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Bouton unique déclenchant une action sans champ (lancer, finaliser…). */
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirm,
  variant = "primary",
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  confirm?: string;
  variant?: "primary" | "ghost";
}) {
  const [state, formAction, pending] = useActionState(() => action(), undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button className={variant === "primary" ? "btn-primary" : "btn-ghost"} disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <p role="alert" className="mt-2 text-sm text-critique">{state.error}</p>;
  if (state?.ok) return <p role="status" className="mt-2 text-sm text-solide">{state.ok}</p>;
  return null;
}
