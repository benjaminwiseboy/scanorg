// ScoringEngine — Build Pack V4, partie 07.1.
import { RULES, round2 } from "./rules";

export type Band = "SOLIDE" | "A_RENFORCER" | "FRAGILE" | "CRITIQUE";

export type ScoreResult =
  | { status: "OK"; score: number; band: Band }
  | { status: "INSUFFICIENT_DATA"; reason: string };

/** 1→0 ; 2→25 ; 3→50 ; 4→75 ; 5→100 */
export const valueToScore = (mean: number) => ((mean - 1) / 4) * 100;

export function bandOf(score: number): Band {
  if (score >= RULES.bands.SOLIDE) return "SOLIDE";
  if (score >= RULES.bands.A_RENFORCER) return "A_RENFORCER";
  if (score >= RULES.bands.FRAGILE) return "FRAGILE";
  return "CRITIQUE";
}

/**
 * Score d'une dimension à partir de toutes les réponses valides (1..5) des
 * répondants éligibles, regroupées. Les NSP/NC ne doivent pas être passés ici.
 */
export function scoreDimension(validValues: number[]): ScoreResult {
  if (validValues.length < RULES.minValidResponsesPerDimension) {
    return {
      status: "INSUFFICIENT_DATA",
      reason: `${validValues.length} réponse(s) valide(s) < minimum ${RULES.minValidResponsesPerDimension}`,
    };
  }
  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const score = round2(valueToScore(mean));
  return { status: "OK", score, band: bandOf(score) };
}

/**
 * Moyenne de sous-scores (pilier = moyenne de 3 dimensions, global = moyenne
 * de E/A/C). Aucune substitution : un sous-score manquant rend le tout
 * INSUFFICIENT_DATA (07.2 — ne jamais remplacer une donnée absente).
 */
export function aggregate(parts: ScoreResult[], label: string): ScoreResult {
  const missing = parts.filter((p) => p.status !== "OK").length;
  if (missing > 0) {
    return {
      status: "INSUFFICIENT_DATA",
      reason: `${label} : ${missing} composante(s) non calculable(s)`,
    };
  }
  const scores = parts.map((p) => (p as { score: number }).score);
  const score = round2(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { status: "OK", score, band: bandOf(score) };
}
