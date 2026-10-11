// Règles et seuils versionnés. Toute modification = nouvelle ENGINE_VERSION.

export const ENGINE_VERSION = "pilot-0.1.0";

export const RULES = {
  /** 07.1 — minimum de réponses valides pour qu'une dimension soit calculable. */
  minValidResponsesPerDimension: 3,
  /** 08.1 — minimum de répondants pour publier un résultat. */
  minRespondents: 5,
  /** 07.1 — bandes de lecture (bornes basses incluses). */
  bands: { SOLIDE: 75, A_RENFORCER: 50, FRAGILE: 25 },
} as const;

/** Arrondi d'affichage/stockage à 2 décimales (tolérance Golden = 0,01). */
export const round2 = (x: number) => Math.round(x * 100) / 100;
