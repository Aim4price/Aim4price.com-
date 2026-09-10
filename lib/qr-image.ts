import QRCode from 'qrcode';

/** Render locally so previews, downloads and labels do not depend on a remote image service. */
export async function renderQrImage(value: string, format: 'svg' | 'png', width: number): Promise<Uint8Array> {
  const options = { width, margin: 4, errorCorrectionLevel: 'M' as const };
  if (format === 'svg') {
    return new TextEncoder().encode(await QRCode.toString(value, { ...options, type: 'svg' }));
  }
  return new Uint8Array(await QRCode.toBuffer(value, { ...options, type: 'png' }));
}
