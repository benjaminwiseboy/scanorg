// ConfidentialityEngine — Build Pack V4, partie 08.
import { RULES } from "./rules";

export type ConfidentialityDecision =
  | "ALLOWED"
  | "RESTRICTED"
  | "INSUFFICIENT_GROUP"
  | "RECONSTRUCTION_RISK"
  | "FORBIDDEN";

/**
 * Décision pour un résultat agrégé. Le pilote ne propose pas encore de
 * segmentation : seul le groupe « organisation entière » est évalué, donc
 * RECONSTRUCTION_RISK ne peut pas survenir ici.
 */
export function decideGroup(respondents: number): ConfidentialityDecision {
  return respondents >= RULES.minRespondents ? "ALLOWED" : "INSUFFICIENT_GROUP";
}
