import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { DIMENSIONS, PILLARS } from "@/engines/methodology/lf-eac-v1";
import type { SnapshotPayload } from "@/engines/finalize";
import type { Band, ScoreResult } from "@/engines/scoring";
import { A4, ACCENT, INK, LINE, M, MUTED, SURFACE_2, clean, footer, wrap } from "./pdf";

// Export de la Carte de Vitalité (Build Pack V4, partie 12) : mêmes contenus et
// mêmes règles de confidentialité que l'écran. Un snapshot BLOCKED ne s'exporte pas.

type Published = Extract<SnapshotPayload, { status: "PUBLISHED" }>;

export type MapPdfInput = {
  organizationName: string;
  campaignName: string;
  snapshot: Published;
  generatedAt: Date;
};

const BAND: Record<Band, { label: string; color: RGB; range: string }> = {
  SOLIDE: { label: "Solide", color: rgb(0.184, 0.478, 0.345), range: "75–100" },
  A_RENFORCER: { label: "À renforcer", color: rgb(0.659, 0.498, 0.071), range: "50–74" },
  FRAGILE: { label: "Fragile", color: rgb(0.761, 0.376, 0.165), range: "25–49" },
  CRITIQUE: { label: "Critique", color: rgb(0.651, 0.235, 0.235), range: "0–24" },
};

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const pct = (n: number) => `${Math.round(n * 100)} %`;
const dateFr = (d: Date) =>
  d.toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

export async function buildMapPdf(input: MapPdfInput): Promise<Uint8Array> {
  const { snapshot: p } = input;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Carte de Vitalité — ${input.campaignName}`);
  pdf.setCreator("ScanORG™");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const ensure = (h: number) => {
    if (y - h < M + 20) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
  };
  const draw = (s: string, x: number, yy: number, size: number, font: PDFFont = regular, color: RGB = INK) =>
    page.drawText(clean(font, s), { x, y: yy, size, font, color });
  const rightAlign = (s: string, xRight: number, yy: number, size: number, font: PDFFont = regular, color: RGB = INK) =>
    draw(s, xRight - font.widthOfTextAtSize(clean(font, s), size), yy, size, font, color);
  const W = A4.w - 2 * M;

  // ─── En-tête ──────────────────────────────────────────────────────────
  draw("ScanORG™", M, y, 11, bold, ACCENT);
  rightAlign("Carte de Vitalité LF™", A4.w - M, y, 9, regular, MUTED);
  y -= 32;
  draw(input.campaignName, M, y, 24, serif);
  y -= 18;
  draw(input.organizationName, M, y, 11, bold);
  y -= 15;
  draw(
    `${p.participation.submitted} répondant(s) sur ${p.participation.invited} lien(s) · participation ${pct(p.participation.rate)} · calculé le ${dateFr(new Date(p.calculatedAt))}`,
    M, y, 8.5, regular, MUTED,
  );
  y -= 24;

  // ─── Score global ─────────────────────────────────────────────────────
  const gH = 70;
  page.drawRectangle({ x: M, y: y - gH, width: W, height: gH, borderColor: LINE, borderWidth: 1 });
  draw("SCORE GLOBAL DE VITALITÉ", M + 16, y - 20, 8, bold, MUTED);
  if (p.map.global.status === "OK") {
    const s = fmt(p.map.global.score);
    draw(s, M + 16, y - 58, 38, serif);
    draw("/ 100", M + 22 + serif.widthOfTextAtSize(s, 38), y - 58, 14, serif, MUTED);
    rightAlign(BAND[p.map.global.band].label, A4.w - M - 16, y - 50, 14, bold, BAND[p.map.global.band].color);
  } else {
    draw("Données insuffisantes", M + 16, y - 50, 18, serif);
    rightAlign("Aucun score n'est estimé à la place.", A4.w - M - 16, y - 48, 8.5, regular, MUTED);
  }
  y -= gH + 14;

  // ─── Piliers et dimensions (3 colonnes) ───────────────────────────────
  const gap = 12;
  const colW = (W - 2 * gap) / 3;
  const pH = 202;
  ensure(pH);
  PILLARS.forEach((pillar, i) => {
    const x = M + i * (colW + gap);
    const pad = 12;
    const inner = colW - 2 * pad;
    page.drawRectangle({ x, y: y - pH, width: colW, height: pH, borderColor: LINE, borderWidth: 1 });
    let cy = y - 18;
    draw(`PILIER ${pillar.code}`, x + pad, cy, 7.5, bold, MUTED);
    cy -= 20;
    draw(pillar.name, x + pad, cy, 15, serif);
    scoreText(p.map.pillars[pillar.code], x + colW - pad, cy, 15);
    cy -= 22;

    for (const d of DIMENSIONS.filter((dd) => dd.pillar === pillar.code)) {
      const r = p.map.dimensions[d.code];
      const valueW = 34;
      const nameLines = wrap(bold, `${d.code} ${d.name}`, 8, inner - valueW);
      nameLines.forEach((l, k) => {
        if (k === 0) {
          draw(d.code, x + pad, cy, 7, regular, MUTED);
          draw(l.slice(d.code.length + 1), x + pad + regular.widthOfTextAtSize(d.code, 7) + 4, cy, 8);
        } else draw(l, x + pad, cy, 8);
        if (k === 0) rightAlign(r.status === "OK" ? fmt(r.score) : "—", x + colW - pad, cy, 8);
        cy -= 10;
      });
      cy -= 2;
      // barre 0..100 avec repères 25/50/75
      page.drawRectangle({ x: x + pad, y: cy, width: inner, height: 5, color: SURFACE_2 });
      if (r.status === "OK") {
        page.drawRectangle({ x: x + pad, y: cy, width: Math.max((inner * r.score) / 100, 2), height: 5, color: BAND[r.band].color });
      }
      for (const t of [25, 50, 75]) {
        page.drawLine({ start: { x: x + pad + (inner * t) / 100, y: cy }, end: { x: x + pad + (inner * t) / 100, y: cy + 5 }, thickness: 1, color: rgb(1, 1, 1) });
      }
      cy -= 11;
      if (r.status === "OK") draw(BAND[r.band].label, x + pad, cy, 7, regular, BAND[r.band].color);
      else draw("Données insuffisantes", x + pad, cy, 7, regular, MUTED);
      cy -= 17;
    }
  });
  y -= pH + 14;

  // ─── Légende ──────────────────────────────────────────────────────────
  let lx = M;
  for (const b of Object.keys(BAND) as Band[]) {
    page.drawCircle({ x: lx + 3, y: y + 2.5, size: 3, color: BAND[b].color });
    const label = `${BAND[b].label} ${BAND[b].range}`;
    draw(label, lx + 10, y, 7.5, regular, MUTED);
    lx += 10 + regular.widthOfTextAtSize(clean(regular, label), 7.5) + 14;
  }
  draw("· Aides de lecture, pas des verdicts.", lx, y, 7.5, regular, MUTED);
  y -= 26;

  // ─── Qualité des données ──────────────────────────────────────────────
  ensure(40 + DIMENSIONS.length * 16);
  draw("Qualité des données", M, y, 12, bold);
  y -= 20;
  const cols = [
    { label: "Dimension", x: M, right: false },
    { label: "Réponses valides", x: M + 290, right: true },
    { label: "NSP / NC", x: M + 350, right: true },
    { label: "Complétude", x: M + 415, right: true },
    { label: "Écart-type (pts)", x: A4.w - M, right: true },
  ];
  for (const c of cols) c.right ? rightAlign(c.label, c.x, y, 8, regular, MUTED) : draw(c.label, c.x, y, 8, regular, MUTED);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.7, color: LINE });
  y -= 13;
  for (const d of DIMENSIONS) {
    const q = p.quality[d.code];
    draw(d.code, M, y, 7, regular, MUTED);
    draw(d.name, M + 16, y, 8.5);
    rightAlign(String(q.nValid), cols[1].x, y, 8.5);
    rightAlign(String(q.nNotApplicable), cols[2].x, y, 8.5);
    rightAlign(pct(q.completionRate), cols[3].x, y, 8.5);
    rightAlign(q.dispersion === null ? "—" : fmt(q.dispersion), cols[4].x, y, 8.5);
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.4, color: LINE });
    y -= 11;
  }
  y -= 14;

  // ─── Limites de lecture ───────────────────────────────────────────────
  const limits = [...p.limitations, "Les configurations, Points de Tension et Leviers ne sont pas encore calculés dans ce pilote."];
  const limitLines = limits.map((l) => wrap(regular, clean(regular, l), 8.5, W - 12));
  ensure(18 + limitLines.flat().length * 13.5 + 24);
  draw("Limites de lecture", M, y, 12, bold);
  y -= 18;
  for (const lines of limitLines) {
    page.drawCircle({ x: M + 2, y: y + 3, size: 1.5, color: MUTED });
    for (const l of lines) {
      draw(l, M + 12, y, 8.5, regular, MUTED);
      y -= 11.5;
    }
    y -= 2;
  }
  y -= 12;
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: A4.w - M, y: y + 6 }, thickness: 0.4, color: LINE });
  y -= 8;
  draw(
    `Méthodologie ${p.methodologyVersion} · moteur ${p.engineVersion} · confidentialité ${p.confidentiality} · exporté le ${dateFr(input.generatedAt)}`,
    M, y, 7.5, regular, MUTED,
  );

  footer(pdf.getPages(), regular, `ScanORG™ · ${input.organizationName} · ${input.campaignName} · Document confidentiel`);
  return pdf.save();

  function scoreText(r: ScoreResult, xRight: number, yy: number, size: number) {
    if (r.status === "OK") rightAlign(fmt(r.score), xRight, yy, size, serif, BAND[r.band].color);
    else rightAlign("Insuffisant", xRight, yy + 2, 8, regular, MUTED);
  }
}
