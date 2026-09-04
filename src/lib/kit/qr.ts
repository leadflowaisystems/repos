import QRCode from 'qrcode';
import { checkPrintableUrl } from './content';

/**
 * QR generation — entirely local.
 *
 * The `qrcode` package renders offline with no network access and no service
 * of any kind. The encoded value is ONLY ever a URL the operator typed in by
 * hand: RepOS does not discover, look up or fetch a listing to build one.
 *
 * SVG is used rather than PNG because these are printed — vector stays crisp
 * at any card size, and it embeds directly in the print sheet with no file
 * handling.
 */

export type QrResult =
  | { ok: true; svg: string; url: string }
  | { ok: false; reason: string };

const OPTIONS = {
  type: 'svg' as const,
  // High correction so a card that gets scuffed on a counter still scans.
  errorCorrectionLevel: 'H' as const,
  margin: 1,
  color: { dark: '#000000', light: '#ffffff' },
};

/**
 * Renders the QR that goes on the printed card.
 *
 * Refuses anything that is not a plain http(s) link, so a malformed or unsafe
 * value can never reach a card that strangers will scan.
 */
export async function generateQrSvg(
  rawUrl: string | null | undefined,
): Promise<QrResult> {
  const check = checkPrintableUrl(rawUrl);
  if (!check.ok) return { ok: false, reason: check.reason };

  try {
    const svg = await QRCode.toString(check.url, OPTIONS);
    return { ok: true, svg, url: check.url };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `Could not render the QR code: ${error.message}`
          : 'Could not render the QR code.',
    };
  }
}
