// Pipeline de finalisation — Build Pack V4, partie 05.3 (sous-ensemble pilote) :
// validateResponses → Quality → Scoring → Confidentiality → Map.
// Les moteurs Configuration / Tension / Levier / Priorité ne sont pas inclus.
import { DIMENSIONS, PILLARS, QUESTIONS, METHODOLOGY_CODE, type DimensionCode, type PillarCode } from "./methodology/lf-eac-v1";
import { aggregate, scoreDimension, type ScoreResult } from "./scoring";
import { dimensionQuality, participation, type DimensionQuality, type Participation } from "./quality";
import { decideGroup, type ConfidentialityDecision } from "./confidentiality";
import { ENGINE_VERSION, RULES } from "./rules";

/** Réponse d'un répondant ayant soumis : value XOR notApplicable. */
export type RawResponse = { questionNumber: number; value: number | null; notApplicable: boolean };
export type Respondent = { responses: RawResponse[] };

export type FinalizeInput = {
  invited: number;
  inProgress: number;
  respondents: Respondent[]; // uniquement les participants SUBMITTED
  calculatedAt: Date;
};

export type VitalityMap = {
  global: ScoreResult;
  pillars: Record<PillarCode, ScoreResult>;
  dimensions: Record<DimensionCode, ScoreResult>;
};

export type SnapshotPayload =
  | {
      status: "PUBLISHED";
      methodologyVersion: string;
      engineVersion: string;
      calculatedAt: string;
      participation: Participation;
      confidentiality: ConfidentialityDecision;
      map: VitalityMap;
      quality: Record<DimensionCode, DimensionQuality>;
      limitations: string[];
    }
  | {
      // Aucun score n'est conservé : rien ne peut fuiter d'un résultat bloqué.
      status: "BLOCKED";
      methodologyVersion: string;
      engineVersion: string;
      calculatedAt: string;
      participation: Participation;
      confidentiality: ConfidentialityDecision;
      limitations: string[];
    };

export class InvalidResponsesError extends Error {}

const DIMENSION_OF = new Map(QUESTIONS.map((q) => [q.number, q.dimension]));

function validateResponses(respondents: Respondent[]) {
  for (const r of respondents) {
    for (const resp of r.responses) {
      if (!DIMENSION_OF.has(resp.questionNumber)) {
        throw new InvalidResponsesError(`Question inconnue : ${resp.questionNumber}`);
      }
      const hasValue = resp.value !== null;
      if (hasValue === resp.notApplicable) {
        throw new InvalidResponsesError(`value XOR notApplicable violé (Q${resp.questionNumber})`);
      }
      if (hasValue && (!Number.isInteger(resp.value) || resp.value! < 1 || resp.value! > 5)) {
        throw new InvalidResponsesError(`Valeur hors échelle (Q${resp.questionNumber})`);
      }
    }
  }
}

export function finalize(input: FinalizeInput): SnapshotPayload {
  validateResponses(input.respondents);

  const base = {
    methodologyVersion: METHODOLOGY_CODE,
    engineVersion: ENGINE_VERSION,
    calculatedAt: input.calculatedAt.toISOString(),
    participation: participation(input.invited, input.respondents.length, input.inProgress),
  };

  const confidentiality = decideGroup(input.respondents.length);
  if (confidentiality !== "ALLOWED") {
    return {
      ...base,
      status: "BLOCKED",
      confidentiality,
      limitations: [
        `Moins de ${RULES.minRespondents} répondants : aucun résultat n'est affiché afin de protéger la confidentialité des participants.`,
      ],
    };
  }

  // Regroupement des réponses individuelles par dimension (08.3 : jamais une
  // moyenne de moyennes de sous-groupes).
  const valid = Object.fromEntries(DIMENSIONS.map((d) => [d.code, [] as number[]])) as Record<DimensionCode, number[]>;
  const na = Object.fromEntries(DIMENSIONS.map((d) => [d.code, 0])) as Record<DimensionCode, number>;
  for (const r of input.respondents) {
    for (const resp of r.responses) {
      const dim = DIMENSION_OF.get(resp.questionNumber)!;
      if (resp.notApplicable) na[dim]++;
      else valid[dim].push(resp.value!);
    }
  }

  const quality = {} as Record<DimensionCode, DimensionQuality>;
  const dimensions = {} as Record<DimensionCode, ScoreResult>;
  for (const d of DIMENSIONS) {
    quality[d.code] = dimensionQuality(valid[d.code], na[d.code]);
    dimensions[d.code] = scoreDimension(valid[d.code]);
  }

  const pillars = {} as Record<PillarCode, ScoreResult>;
  for (const p of PILLARS) {
    const parts = DIMENSIONS.filter((d) => d.pillar === p.code).map((d) => dimensions[d.code]);
    pillars[p.code] = aggregate(parts, `Pilier ${p.name}`);
  }
  const global = aggregate(PILLARS.map((p) => pillars[p.code]), "Score global");

  const limitations: string[] = [
    "Les seuils de lecture (Solide, À renforcer, Fragile, Critique) sont des aides de lecture, pas des verdicts.",
    "Le niveau de dispersion n'est pas qualifié : le seuil « dispersion élevée » n'est pas encore défini dans LF-EAC-V1.",
  ];
  const insufficient = DIMENSIONS.filter((d) => dimensions[d.code].status !== "OK");
  if (insufficient.length > 0) {
    limitations.push(
      `Données insuffisantes pour : ${insufficient.map((d) => d.code).join(", ")}. Aucun score n'a été estimé à leur place.`,
    );
  }
  if (base.participation.rate < 0.5) {
    limitations.push("Participation inférieure à 50 % des liens générés : la représentativité est limitée.");
  }

  return {
    ...base,
    status: "PUBLISHED",
    confidentiality,
    map: { global, pillars, dimensions },
    quality,
    limitations,
  };
}
