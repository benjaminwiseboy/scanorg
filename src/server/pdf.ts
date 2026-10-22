import "server-only";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Briques communes aux exports PDF (fiche participant, Carte de Vitalité).

export const A4 = { w: 595.28, h: 841.89 };
export const M = 50; // marge
export const ACCENT = rgb(0.122, 0.306, 0.475); // #1f4e79
export const INK = rgb(0.1, 0.13, 0.19);
export const MUTED = rgb(0.36, 0.4, 0.46);
export const LINE = rgb(0.886, 0.875, 0.843);
export const SURFACE_2 = rgb(0.937, 0.929, 0.906);

/** Les polices standard PDF sont en WinAnsi : on remplace tout caractère non encodable. */
export function clean(font: PDFFont, s: string) {
  return [...s.replace(/[  ]/g, " ")]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return "?";
      }
    })
    .join("");
}

export function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Pied de page numéroté sur toutes les pages. */
export function footer(pages: PDFPage[], font: PDFFont, label: string) {
  pages.forEach((p, i) => {
    p.drawText(clean(font, label), { x: M, y: 28, size: 7.5, font, color: MUTED });
    const n = `${i + 1} / ${pages.length}`;
    p.drawText(n, { x: A4.w - M - font.widthOfTextAtSize(n, 7.5), y: 28, size: 7.5, font, color: MUTED });
  });
}

export const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);
