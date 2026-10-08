import type { ExternalAssetShareItem } from './asset-external-share';

/** Render only the supplied recipient-visible fields; never look up extra asset data. */
export async function createAssetShareCards(asset: ExternalAssetShareItem, photos: File[], assetIndex: number): Promise<File[]> {
  const cards: File[] = [];
  const pages = Math.max(1, Math.ceil(photos.length / 4));
  for (let page = 0; page < pages; page++) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    const context = canvas.getContext('2d');
    if (!context) throw Error('This device cannot prepare asset photo cards.');
    const ctx = context;
    function lines(value: string, width: number): string[] {
      const result: string[] = []; let line = '';
      for (const char of value) {
        if (char === '\n' || ctx.measureText(line + char).width > width) { result.push(line); line = char === '\n' ? '' : char; }
        else line += char;
      }
      if (line) result.push(line);
      return result;
    }
    ctx.font = 'bold 44px Arial';
    const heading = lines(asset.title || 'Asset', 1080);
    ctx.font = '30px Arial';
    const money = (value: number | null) => value == null ? 'Not shared' : `R ${Math.round(value).toLocaleString('en-ZA')}`;
    const facts = [
      `Serial / VIN: ${asset.serialNumber || 'Not recorded'}`,
      `Year: ${asset.yearModel || 'Not recorded'}  •  Usage: ${asset.usage || 'Not recorded'}`,
      `Condition: ${asset.condition || 'Not recorded'}`,
      `Current value (excl. VAT): ${money(asset.valueExVat)}`,
      `Replacement value (excl. VAT): ${money(asset.replacementPriceExVat)}`,
    ].flatMap(value => lines(value, 1080));
    const batch = photos.slice(page * 4, page * 4 + 4);
    const photoWidth = batch.length === 1 ? 1100 : 540;
    const photoHeight = batch.length === 1 ? 600 : 350;
    const rowHeight = photoHeight + 30;
    const photoTop = 120 + heading.length * 54 + facts.length * 42;
    canvas.height = photoTop + (batch.length ? Math.ceil(batch.length / 2) * rowHeight : 110) + 110;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#123e31'; ctx.fillRect(0, 0, 1200, 58);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Arial'; ctx.fillText('AIM4PRICE  ·  ASSET DETAILS', 50, 38);
    ctx.textAlign = 'right'; ctx.fillText(`Asset ${assetIndex + 1}${pages > 1 ? ` · ${page + 1}/${pages}` : ''}`, 1150, 38); ctx.textAlign = 'left';
    ctx.fillStyle = '#123e31'; ctx.font = 'bold 44px Arial';
    heading.forEach((line, i) => ctx.fillText(line, 50, 116 + i * 54));
    ctx.font = '30px Arial'; ctx.fillStyle = '#344c44';
    facts.forEach((line, i) => ctx.fillText(line, 50, 144 + heading.length * 54 + i * 42));
    for (let i = 0; i < batch.length; i++) {
      const url = URL.createObjectURL(batch[i]);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const x = 50 + (i % 2) * 560, y = photoTop + Math.floor(i / 2) * rowHeight;
        const scale = Math.min(photoWidth / image.naturalWidth, photoHeight / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.fillStyle = '#f0f5f2'; ctx.fillRect(x, y, photoWidth, photoHeight);
        ctx.drawImage(image, x + (photoWidth - w) / 2, y + (photoHeight - h) / 2, w, h);
      } catch { throw Error(`Could not prepare a photo for ${asset.title}. Please retry.`); }
      finally { URL.revokeObjectURL(url); }
    }
    if (!batch.length) { ctx.font = '28px Arial'; ctx.fillText('No photos shared for this asset.', 50, photoTop + 55); }
    ctx.font = '22px Arial'; ctx.fillStyle = '#60766c';
    ctx.fillText('Shared from Aim4price. Saved estimates remain subject to inspection.', 50, canvas.height - 55);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Could not create asset card.')), 'image/jpeg', .92));
    const name = (asset.title + '-' + asset.serialNumber).replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 100);
    cards.push(new File([blob], `asset-${assetIndex + 1}-${name}-${page + 1}.jpg`, {type:'image/jpeg'}));
  }
  return cards;
}
