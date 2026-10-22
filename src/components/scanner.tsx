"use client";

import { useRef, useState } from "react";
import { Brand } from "./brand";
import { SCANNER_BLOCKS } from "@/engines/methodology/lf-eac-v1";

export type ScanAnswer = 1 | 2 | 3 | 4 | 5 | "NSP";
type Question = { id: string; number: number; text: string };
type Step = "intro" | number | "review" | "done";
type SaveState = "saving" | "saved" | "error";

const SCALE = [1, 2, 3, 4, 5] as const;

export function Scanner({
  token,
  campaignName,
  questions,
  initial,
}: {
  token: string;
  campaignName: string;
  questions: Question[];
  initial: Record<string, ScanAnswer>;
}) {
  const blocks = SCANNER_BLOCKS.map(([from, to]) => questions.filter((q) => q.number >= from && q.number <= to));
  const [answers, setAnswers] = useState(initial);
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Reprise sur le premier bloc contenant une question sans réponse.
  const [step, setStep] = useState<Step>(() => {
    if (Object.keys(initial).length === 0) return "intro";
    const i = blocks.findIndex((b) => b.some((q) => !(q.id in initial)));
    return i === -1 ? "review" : i;
  });
  // Les enregistrements sont sérialisés : la dernière réponse cliquée gagne.
  const queue = useRef(Promise.resolve());

  const answeredCount = questions.filter((q) => q.id in answers).length;
  const missing = questions.filter((q) => !(q.id in answers));

  function answer(q: Question, a: ScanAnswer) {
    setAnswers((s) => ({ ...s, [q.id]: a }));
    setSaves((s) => ({ ...s, [q.id]: "saving" }));
    const body = a === "NSP" ? { notApplicable: true } : { value: a };
    queue.current = queue.current.then(async () => {
      try {
        const res = await fetch(`/api/v1/scan/${token}/responses/${q.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Request-ID": crypto.randomUUID() },
          body: JSON.stringify(body),
        });
        setSaves((s) => ({ ...s, [q.id]: res.ok ? "saved" : "error" }));
      } catch {
        setSaves((s) => ({ ...s, [q.id]: "error" }));
      }
    });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    await queue.current;
    const res = await fetch(`/api/v1/scan/${token}/submit`, {
      method: "POST",
      headers: { "X-Request-ID": crypto.randomUUID() },
    }).catch(() => null);
    setSubmitting(false);
    if (res?.ok) return setStep("done");
    const err = await res?.json().catch(() => null);
    setSubmitError(err?.error?.message ?? "La soumission a échoué. Vérifiez votre connexion et réessayez.");
  }

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-6">
      <header className="flex items-center justify-between gap-3">
        <Brand small />
        {typeof step === "number" && (
          <span className="text-sm text-muted tabular-nums">{answeredCount} / {questions.length}</span>
        )}
      </header>
      {typeof step === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full bg-accent transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      )}

      {step === "intro" && (
        <section className="mt-10 space-y-5">
          <p className="eyebrow">{campaignName}</p>
          <h1 className="font-serif text-3xl">Scanner de Vitalité LF™</h1>
          <div className="space-y-3 text-muted">
            <p>42 affirmations sur votre organisation, réparties en 9 courtes étapes. Comptez une dizaine de minutes.</p>
            <p>Pour chacune, indiquez votre degré d'accord de 1 à 5. Si vous ne savez pas ou si elle ne vous concerne pas, choisissez « NSP / NC ».</p>
            <p>Vos réponses sont enregistrées au fil de l'eau : vous pouvez vous arrêter et reprendre plus tard avec ce même lien.</p>
            <p>
              <strong className="text-ink">Vous contribuez, vous n'êtes pas évalué(e).</strong> Seuls des résultats collectifs sont
              affichés, et uniquement à partir de 5 répondants. Personne dans l'organisation ne voit vos réponses individuelles.
            </p>
          </div>
          <button className="btn-primary" onClick={() => go(0)}>Commencer</button>
        </section>
      )}

      {typeof step === "number" && (
        <section className="mt-8">
          <p className="eyebrow">Étape {step + 1} sur {blocks.length}</p>
          <p className="mt-1 text-sm text-muted">1 = pas du tout d'accord · 5 = tout à fait d'accord · NSP / NC = ne sait pas ou non concerné(e)</p>
          <div className="mt-4 space-y-4">
            {blocks[step].map((q) => (
              <QuestionCard key={q.id} q={q} value={answers[q.id]} save={saves[q.id]} onAnswer={(a) => answer(q, a)} />
            ))}
          </div>
          <nav className="mt-8 flex justify-between gap-3">
            <button className="btn-ghost" onClick={() => go(step === 0 ? "intro" : step - 1)}>Précédent</button>
            <button className="btn-primary" onClick={() => go(step === blocks.length - 1 ? "review" : step + 1)}>
              {step === blocks.length - 1 ? "Vérifier mes réponses" : "Suivant"}
            </button>
          </nav>
        </section>
      )}

      {step === "review" && (
        <section className="mt-10 space-y-5">
          <h1 className="font-serif text-2xl">Revue finale</h1>
          {missing.length > 0 ? (
            <div className="card space-y-3">
              <p>{missing.length} question(s) sans réponse. Répondez-y (NSP / NC est possible) pour pouvoir envoyer.</p>
              <ul className="flex flex-wrap gap-2">
                {missing.map((q) => (
                  <li key={q.id}>
                    <button
                      className="btn-ghost px-3 py-1.5"
                      onClick={() => go(blocks.findIndex((b) => b.some((x) => x.id === q.id)))}
                    >
                      Q{q.number}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted">
              Vous avez répondu aux 42 questions. Après l'envoi, vos réponses ne pourront plus être modifiées.
            </p>
          )}
          {submitError && <p role="alert" className="text-sm text-critique">{submitError}</p>}
          <div className="flex justify-between gap-3">
            <button className="btn-ghost" onClick={() => go(blocks.length - 1)}>Précédent</button>
            <button className="btn-primary" disabled={missing.length > 0 || submitting} onClick={submit}>
              {submitting ? "Envoi…" : "Envoyer mes réponses"}
            </button>
          </div>
        </section>
      )}

      {step === "done" && (
        <section className="mt-16 space-y-3">
          <h1 className="font-serif text-3xl">Merci pour votre contribution.</h1>
          <p className="text-muted">Vos réponses ont été transmises. Vous pouvez fermer cette page.</p>
          <SheetDownload token={token} />
        </section>
      )}
    </main>
  );
}

function QuestionCard({
  q,
  value,
  save,
  onAnswer,
}: {
  q: Question;
  value: ScanAnswer | undefined;
  save: SaveState | undefined;
  onAnswer: (a: ScanAnswer) => void;
}) {
  const name = `q-${q.number}`;
  return (
    <fieldset className="card">
      <legend className="sr-only">Question {q.number}</legend>
      <p className="flex gap-3">
        <span className="font-mono text-sm text-muted">{q.number}.</span>
        <span>{q.text}</span>
      </p>
      <div className="mt-4 grid grid-cols-5 gap-2 sm:flex sm:items-center">
        {SCALE.map((v) => (
          <Choice key={v} name={name} label={String(v)} checked={value === v} onChange={() => onAnswer(v)} />
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:inline-block" aria-hidden />
        <div className="col-span-5 sm:col-span-1">
          <Choice name={name} label="NSP / NC" wide checked={value === "NSP"} onChange={() => onAnswer("NSP")} />
        </div>
      </div>
      <div className="mt-2 flex min-h-4 justify-end text-xs text-muted">
        <span aria-live="polite">
          {save === "saving" && "Enregistrement…"}
          {save === "saved" && "Enregistré"}
          {save === "error" && <span className="text-critique">Non enregistré — recliquez</span>}
        </span>
      </div>
    </fieldset>
  );
}

function Choice({ name, label, checked, wide, onChange }: { name: string; label: string; checked: boolean; wide?: boolean; onChange: () => void }) {
  return (
    <label
      className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition has-focus-visible:ring-2 has-focus-visible:ring-accent/40 ${
        wide ? "w-full px-4 sm:w-auto" : "sm:w-11"
      } ${checked ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:bg-surface-2"}`}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

/** Lien de téléchargement de la fiche PDF (réponses déjà soumises). */
export function SheetDownload({ token }: { token: string }) {
  return (
    <div className="pt-4">
      <a href={`/api/v1/scan/${token}/sheet`} download className="btn-ghost">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
        </svg>
        Télécharger ma fiche (PDF)
      </a>
      <p className="mt-2 text-xs text-muted">Vos 42 réponses, pour garder une trace. Ce n'est pas un score.</p>
    </div>
  );
}
