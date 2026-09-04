import QRCode from 'qrcode';

/**
 * QR rendering for the feedback page — entirely local (M14).
 *
 * The `qrcode` package encodes offline. The value encoded is always the
 * client's own feedback address, built by RepOS from the operator's configured
 * base address and the client's public token. Nothing is looked up.
 *
 * Two renderings: SVG for the print sheet and the on-screen preview (crisp at
 * any size), and a PNG for the operator to download and send to a print shop
 * or drop into a message.
 */

export type GatewayQr = {
  url: string;
  svg: string;
  /** data:image/png;base64,… at 1024px, plenty for an A5 card. */
  pngDataUrl: string;
};

const LEVEL = 'H' as const;

export async function renderGatewayQr(url: string): Promise<GatewayQr> {
  const [svg, pngDataUrl] = await Promise.all([
    QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: LEVEL,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }),
    QRCode.toDataURL(url, {
      type: 'image/png',
      errorCorrectionLevel: LEVEL,
      margin: 2,
      width: 1024,
      color: { dark: '#000000', light: '#ffffff' },
    }),
  ]);
  return { url, svg, pngDataUrl };
}
