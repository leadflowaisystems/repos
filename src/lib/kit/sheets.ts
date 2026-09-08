/**
 * THE TWO APPROVED PRINT MASTERS.
 *
 * These are files, not templates. Both PDFs under `public/print-kit` are the
 * signed-off Headway artwork. Nothing composes, redraws or re-renders them,
 * and there is no third format: the only things that change between one
 * business's sheet and another's are the name and the QR, swapped into the
 * master itself by `personalise.ts`. The numbers and wording below only
 * describe the sheets so the owner knows which one to pick — they are read off
 * the files themselves and change nothing.
 *
 * WHY TWO AND NOT ONE. They are the same card at the same size (4 × 6 in), for
 * the two ways a card actually ends up on a counter:
 *
 *   the insert  — one card into an L-stand, or two back to back into a T-stand
 *   the pair    — two faces joined, so it folds into a free-standing tent with
 *                 nothing to buy, or cuts into two ordinary stand cards
 *
 * WHY THE PREVIEWS ARE PNG. The app sends
 * `Content-Security-Policy: frame-ancestors 'none'` on every response, so a PDF
 * cannot be shown in an iframe even from the same origin. Each preview is a
 * still of page one of the very PDF beside it, rendered from that file, and it
 * links to the file.
 */

export type PrintSheet = {
  key: string;
  /** What the owner picks it by. */
  label: string;
  /** The paper and how many cards come off it, for the line under the label. */
  sheetNote: string;
  /** What this sheet is for. */
  what: string;
  /** What to do with it once it is printed. */
  finish: string;
  /** Paper, scale and card weight, off the sheet's own footer. */
  spec: string;
  /**
   * The approved master, under `public/print-kit`.
   *
   * Never linked directly: it carries `YOUR BUSINESS NAME` and a placeholder
   * code. The route at `/print/sheet/[clientId]/[key]` reads it, fills in those
   * two things, and hands over the result.
   */
  file: string;
  /** A still of page one of that PDF. */
  preview: string;
  /** The preview's own pixel size, so the layout reserves the right box. */
  previewWidth: number;
  previewHeight: number;
  /** A filename a print shop can read, for the download. */
  downloadAs: string;
};

export const PRINT_SHEETS: readonly PrintSheet[] = [
  {
    key: 'insert-4x6',
    label: '4 × 6 in Insert Card',
    sheetNote: 'A4 · two cards per sheet',
    what: 'Two 4 × 6 in cards on one A4 sheet, for an acrylic stand.',
    finish: 'Cut on the dashed line. One card in an L-stand, or two back to back in a T-stand.',
    spec: 'A4 at 100% · card 101.6 × 152.4 mm · 250–300 gsm matte card, no lamination needed',
    file: '/print-kit/headway-4x6-insert-PRINT-MASTER.pdf',
    preview: '/print-kit/headway-4x6-insert-preview.png',
    previewWidth: 1191,
    previewHeight: 1684,
    downloadAs: 'headway-4x6-insert-card.pdf',
  },
  {
    key: 'pair-legal',
    label: 'Legal Joined Pair — Tent + Stand Cards',
    sheetNote: 'Legal · two joined pairs per sheet',
    what: 'Two joined pairs on one Legal sheet. No stand to buy.',
    finish:
      'Cut on the dashed outline, then either score and fold the dotted line, printed side out, for a standing tent — or cut the dotted line for two stand cards.',
    spec: 'Legal 8.5 × 14 in at 100% · each face 101.6 × 152.4 mm · 250–300 gsm matte card',
    file: '/print-kit/headway-pair-LEGAL-PRINT-MASTER.pdf',
    preview: '/print-kit/headway-pair-legal-preview.png',
    previewWidth: 1193,
    previewHeight: 1966,
    downloadAs: 'headway-joined-pair-tent-and-stand-cards.pdf',
  },
] as const;
