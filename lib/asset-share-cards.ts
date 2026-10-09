import type { ExternalAssetShareItem } from './asset-external-share';

/** One complete photo per file, identified by its position in the shared asset list. */
export async function createAssetShareCards(asset: ExternalAssetShareItem, photos: File[], assetIndex: number): Promise<File[]> {
  const numbered: File[] = [];
  for (let photoIndex = 0; photoIndex < photos.length; photoIndex++) {
    const url = URL.createObjectURL(photos[photoIndex]);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw Error('Empty photo');
      const canvas = document.createElement('canvas');
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1600, Math.max(320, longest)) / longest;
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Canvas unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const shortSide = Math.min(canvas.width, canvas.height);
      const size = Math.max(12, Math.round(shortSide * .07));
      const padding = Math.max(4, Math.round(size * .4));
      const inset = Math.max(4, Math.round(shortSide * .02));
      const label = String(assetIndex + 1);
      ctx.font = `bold ${size}px Arial`;
      const width = ctx.measureText(label).width + padding * 2;
      const height = size + padding * 2;
      ctx.fillStyle = '#123e31';
      ctx.fillRect(inset, inset, width, height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, size / 20);
      ctx.strokeRect(inset, inset, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, inset + padding, inset + height / 2);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Image encoding failed')), 'image/jpeg', .9));
      const name = (asset.title + '-' + asset.serialNumber).replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 100);
      numbered.push(new File([blob], `asset-${assetIndex + 1}-${name}-photo-${photoIndex + 1}.jpg`, {type:'image/jpeg'}));
    } catch {
      throw Error(`Could not prepare a photo for asset ${assetIndex + 1}. Please retry.`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return numbered;
}
