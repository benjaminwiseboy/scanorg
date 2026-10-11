import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../src/engines/methodology/lf-eac-v1";
import { bandOf, scoreDimension, valueToScore, aggregate } from "../src/engines/scoring";
import { decideGroup } from "../src/engines/confidentiality";
import { finalize, InvalidResponsesError, type Respondent } from "../src/engines/finalize";

const at = new Date("2026-10-11T00:00:00Z");

/** Répondant qui donne `value` à toutes les questions (sauf surcharges). */
function respondent(value: number, overrides: Record<number, number | "NSP"> = {}): Respondent {
  return {
    responses: QUESTIONS.map((q) => {
      const o = overrides[q.number];
      if (o === "NSP") return { questionNumber: q.number, value: null, notApplicable: true };
      return { questionNumber: q.number, value: o ?? value, notApplicable: false };
    }),
  };
}

describe("METH-001 — référentiel LF-EAC-V1", () => {
  it("contient exactement 42 questions numérotées 1..42", () => {
    expect(QUESTIONS.map((q) => q.number)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
  });
});

describe("SCORE-001 — scoring", () => {
  it.each([[1, 0], [2, 25], [3, 50], [4, 75], [5, 100]])("%i → %i", (v, s) => {
    expect(valueToScore(v)).toBe(s);
  });

  it.each([
    [75, "SOLIDE"], [50, "A_RENFORCER"], [25, "FRAGILE"],
    [74.99, "A_RENFORCER"], [49.99, "FRAGILE"], [24.99, "CRITIQUE"], [100, "SOLIDE"], [0, "CRITIQUE"],
  ])("frontière %f → %s", (score, band) => {
    expect(bandOf(score)).toBe(band);
  });
});

describe("QUAL-001 — minimum 3 réponses valides", () => {
  it("2 réponses valides → INSUFFICIENT_DATA", () => {
    expect(scoreDimension([4, 5]).status).toBe("INSUFFICIENT_DATA");
  });
  it("3 réponses valides → calculable", () => {
    expect(scoreDimension([4, 4, 4])).toEqual({ status: "OK", score: 75, band: "SOLIDE" });
  });
  it("un pilier dont une dimension est insuffisante n'est pas calculé (pas de substitution)", () => {
    const r = aggregate([{ status: "OK", score: 80, band: "SOLIDE" }, scoreDimension([1])], "test");
    expect(r.status).toBe("INSUFFICIENT_DATA");
  });
});

describe("CONF-001 — minimum 5 répondants", () => {
  it("4 répondants → INSUFFICIENT_GROUP", () => expect(decideGroup(4)).toBe("INSUFFICIENT_GROUP"));
  it("5 répondants → ALLOWED", () => expect(decideGroup(5)).toBe("ALLOWED"));

  it("finalisation avec 4 répondants → BLOCKED, aucun score dans le snapshot", () => {
    const res = finalize({ invited: 10, inProgress: 0, respondents: Array.from({ length: 4 }, () => respondent(4)), calculatedAt: at });
    expect(res.status).toBe("BLOCKED");
    expect(JSON.stringify(res)).not.toContain("score");
  });
});

describe("finalisation", () => {
  it("5 répondants homogènes à 4 → 75 partout", () => {
    const res = finalize({ invited: 5, inProgress: 0, respondents: Array.from({ length: 5 }, () => respondent(4)), calculatedAt: at });
    expect(res.status).toBe("PUBLISHED");
    if (res.status !== "PUBLISHED") return;
    expect(res.map.global).toEqual({ status: "OK", score: 75, band: "SOLIDE" });
    expect(res.methodologyVersion).toBe("LF-EAC-V1");
    expect(res.quality.E1.dispersion).toBe(0);
  });

  it("les NSP sont exclus du calcul", () => {
    // E1 (Q1..Q5) : tous les répondants mettent NSP sauf sur Q1 = 5.
    const nsp = { 2: "NSP", 3: "NSP", 4: "NSP", 5: "NSP", 1: 5 } as const;
    const res = finalize({ invited: 5, inProgress: 0, respondents: Array.from({ length: 5 }, () => respondent(3, nsp)), calculatedAt: at });
    if (res.status !== "PUBLISHED") throw new Error("expected PUBLISHED");
    expect(res.map.dimensions.E1).toEqual({ status: "OK", score: 100, band: "SOLIDE" });
    expect(res.quality.E1).toMatchObject({ nValid: 5, nNotApplicable: 20 });
  });

  it("dimension entièrement NSP → INSUFFICIENT_DATA, pilier et global non calculés", () => {
    const allNsp = { 31: "NSP", 32: "NSP", 33: "NSP", 34: "NSP" } as const;
    const res = finalize({ invited: 5, inProgress: 0, respondents: Array.from({ length: 5 }, () => respondent(4, allNsp)), calculatedAt: at });
    if (res.status !== "PUBLISHED") throw new Error("expected PUBLISHED");
    expect(res.map.dimensions.C1.status).toBe("INSUFFICIENT_DATA");
    expect(res.map.pillars.C.status).toBe("INSUFFICIENT_DATA");
    expect(res.map.global.status).toBe("INSUFFICIENT_DATA");
    expect(res.map.pillars.E.status).toBe("OK");
  });

  it("score global = moyenne des piliers, calculés sur les réponses individuelles regroupées", () => {
    // 5 répondants à 5 sur E, 3 sur A, 1 sur C → E=100, A=50, C=0, global=50
    const byPillar = (q: number) => (q <= 15 ? 5 : q <= 30 ? 3 : 1);
    const r: Respondent = { responses: QUESTIONS.map((q) => ({ questionNumber: q.number, value: byPillar(q.number), notApplicable: false })) };
    const res = finalize({ invited: 5, inProgress: 0, respondents: [r, r, r, r, r], calculatedAt: at });
    if (res.status !== "PUBLISHED") throw new Error("expected PUBLISHED");
    expect([res.map.pillars.E, res.map.pillars.A, res.map.pillars.C].map((p) => p.status === "OK" && p.score)).toEqual([100, 50, 0]);
    expect(res.map.global).toEqual({ status: "OK", score: 50, band: "A_RENFORCER" });
  });

  it("refuse des réponses invalides (value XOR notApplicable)", () => {
    const bad: Respondent = { responses: [{ questionNumber: 1, value: 3, notApplicable: true }] };
    expect(() => finalize({ invited: 5, inProgress: 0, respondents: [bad], calculatedAt: at })).toThrow(InvalidResponsesError);
  });
});
