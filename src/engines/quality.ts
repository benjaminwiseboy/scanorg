// QualityEngine — Build Pack V4, partie 07.2.
import { round2 } from "./rules";

export type DimensionQuality = {
  nValid: number;
  nNotApplicable: number;
  /** part des réponses valides parmi toutes les réponses de la dimension (0..1) */
  completionRate: number;
  /** écart-type des réponses valides, exprimé en points de score (0..100) */
  dispersion: number | null;
  /** Le seuil « dispersion HIGH » n'est pas défini dans LF-EAC-V1. */
  dispersionLevel: "TO_VERIFY";
};

export function dimensionQuality(validValues: number[], nNotApplicable: number): DimensionQuality {
  const total = validValues.length + nNotApplicable;
  let dispersion: number | null = null;
  if (validValues.length >= 2) {
    const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const variance = validValues.reduce((a, v) => a + (v - mean) ** 2, 0) / validValues.length;
    dispersion = round2(Math.sqrt(variance) * 25); // 1 point d'échelle = 25 points de score
  }
  return {
    nValid: validValues.length,
    nNotApplicable,
    completionRate: total === 0 ? 0 : round2(validValues.length / total),
    dispersion,
    dispersionLevel: "TO_VERIFY",
  };
}

export type Participation = {
  invited: number;
  submitted: number;
  inProgress: number;
  /** taux de participation (0..1) */
  rate: number;
};

export function participation(invited: number, submitted: number, inProgress: number): Participation {
  return {
    invited,
    submitted,
    inProgress,
    rate: invited === 0 ? 0 : round2(submitted / invited),
  };
}
