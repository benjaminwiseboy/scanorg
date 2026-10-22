import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { A4, ACCENT, INK, LINE, M, MUTED, clean, footer, wrap } from "./pdf";
import { DIMENSIONS, METHODOLOGY_CODE, PILLARS } from "@/engines/methodology/lf-eac-v1";

// Fiche personnelle du participant : ses réponses, sans aucun score
// (Annexe A — le collaborateur contribue, il n'est pas évalué).

export type SheetInput = {
  campaignName: string;
  submittedAt: Date;
  questions: { number: number; dimension: string; text: string; answer: number | "NSP" | null }[];
};

export async function buildScanSheet(input: SheetInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fiche scanner — ${input.campaignName}`);
  pdf.setCreator("ScanORG™");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - M;
  };
  const text = (s: string, x: number, size: number, font = regular, color = INK) =>
    page.drawText(clean(font, s), { x, y, size, font, color });

  // En-tête
  text("ScanORG™", M, 11, bold, ACCENT);
  y -= 30;
  text("Fiche scanner — mes réponses", M, 22, serif);
  y -= 22;
  text(input.campaignName, M, 12, bold);
  y -= 16;
  const date = input.submittedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  text(`Réponses transmises le ${date} · Méthodologie ${METHODOLOGY_CODE} · 42 questions`, M, 9, regular, MUTED);
  y -= 22;
  for (const l of wrap(
    regular,
    "Cette fiche est personnelle : elle reprend vos réponses telles que vous les avez transmises. Ce n'est pas un score ni une évaluation. Votre organisation ne voit que des résultats collectifs, à partir de 5 répondants.",
    9,
    A4.w - 2 * M,
  )) {
    text(l, M, 9, regular, MUTED);
    y -= 12;
  }
  y -= 8;
  text("Échelle : 1 = pas du tout d'accord · 5 = tout à fait d'accord · NSP / NC = ne sait pas ou non concerné(e)", M, 8.5, regular, MUTED);
  y -= 26;

  const ANSWER_W = 120; // colonne de droite
  const TEXT_W = A4.w - 2 * M - ANSWER_W - 28;

  for (const pillar of PILLARS) {
    if (y < M + 120) newPage();
    page.drawRectangle({ x: M, y: y - 6, width: A4.w - 2 * M, height: 22, color: ACCENT });
    y += 1;
    text(`Pilier ${pillar.code} — ${pillar.name}`, M + 8, 11, bold, rgb(1, 1, 1));
    y -= 26;

    for (const dim of DIMENSIONS.filter((d) => d.pillar === pillar.code)) {
      if (y < M + 80) newPage();
      text(`${dim.code} · ${dim.name}`, M, 10, bold, ACCENT);
      y -= 14;

      for (const q of input.questions.filter((x) => x.dimension === dim.code)) {
        const lines = wrap(regular, clean(regular, q.text), 9.5, TEXT_W);
        const blockH = Math.max(lines.length * 12.5, 14) + 10;
        if (y - blockH < M + 20) newPage();
        const top = y;
        text(`${q.number}.`, M, 9.5, bold, MUTED);
        for (const l of lines) {
          text(l, M + 24, 9.5);
          y -= 12.5;
        }
        // Réponse : 5 pastilles, la choisie remplie ; sinon « NSP / NC »
        const ax = A4.w - M - ANSWER_W;
        const cy = top + 3;
        if (q.answer === "NSP" || q.answer === null) {
          page.drawText(clean(bold, q.answer === null ? "Sans réponse" : "NSP / NC"), { x: ax, y: top, size: 9, font: bold, color: MUTED });
        } else {
          for (let v = 1; v <= 5; v++) {
            const cx = ax + 6 + (v - 1) * 20;
            const on = v === q.answer;
            page.drawCircle({ x: cx, y: cy, size: 6.5, color: on ? ACCENT : undefined, borderColor: on ? ACCENT : LINE, borderWidth: 1 });
            page.drawText(String(v), { x: cx - 2.5, y: cy - 3, size: 7, font: on ? bold : regular, color: on ? rgb(1, 1, 1) : MUTED });
          }
        }
        y = Math.min(y, top - 14) - 6;
        page.drawLine({ start: { x: M, y: y + 3 }, end: { x: A4.w - M, y: y + 3 }, thickness: 0.5, color: LINE });
        y -= 6;
      }
      y -= 8;
    }
  }

  footer(pdf.getPages(), regular, `ScanORG™ · Document personnel · ${input.campaignName}`);

  return pdf.save();
}
