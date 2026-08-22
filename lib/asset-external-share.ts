export type ExternalAssetShareItem = {
  title: string;
  serialNumber: string;
  yearModel: number | null;
  usage: string;
  condition: string;
  replacementPriceExVat: number | null;
  valueExVat: number | null;
  photoUrls: string[];
  publicUrl: string | null;
};

export type ExternalAssetShareCopy = {
  subject: string;
  body: string;
};

export type ExternalAssetShareCopyOptions = {
  attachedPhotoCount?: number;
  attachedReportCount?: number;
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `R ${Math.round(amount).toLocaleString('en-ZA').replace(/\u00a0/g, ' ')}`
    : 'Not saved';
}

function savedText(value: unknown): string {
  const saved = cleanText(value);
  return saved && saved !== '—' ? saved : 'Not saved';
}

function buildAssetBlock(asset: ExternalAssetShareItem, index: number, includeNumber: boolean): string[] {
  const title = savedText(asset.title);

  return [
    includeNumber ? `${index + 1}. ${title}` : title,
    `Serial number: ${savedText(asset.serialNumber)}`,
    `Year: ${asset.yearModel && asset.yearModel > 0 ? Math.round(asset.yearModel) : 'Not saved'}`,
    `Usage: ${savedText(asset.usage)}`,
    `Condition: ${savedText(asset.condition)}`,
    `Replacement price (excl. VAT): ${formatMoney(asset.replacementPriceExVat)}`,
    `Current value (excl. VAT): ${formatMoney(asset.valueExVat)}`,
  ];
}

function buildAttachmentLine(options: ExternalAssetShareCopyOptions): string {
  const photoCount = Math.max(0, Math.floor(Number(options.attachedPhotoCount) || 0));
  const reportCount = Math.max(0, Math.floor(Number(options.attachedReportCount) || 0));
  const attachments = [
    photoCount ? `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : '',
    reportCount ? `${reportCount} Aim4price ${reportCount === 1 ? 'report' : 'reports'}` : '',
  ].filter(Boolean);

  return attachments.length ? `Attachments: ${attachments.join(', ')}` : '';
}

export function buildExternalAssetShareCopy(
  shareName: string,
  assets: ExternalAssetShareItem[],
  options: ExternalAssetShareCopyOptions = {},
): ExternalAssetShareCopy {
  const safeShareName = cleanText(shareName) || cleanText(assets[0]?.title) || 'Aim4price asset';
  const shareableAssets = assets.filter((asset) => cleanText(asset.title));
  const subject = shareableAssets.length === 1
    ? `${shareableAssets[0].title} asset details`
    : `${safeShareName} asset details`;
  const attachmentLine = buildAttachmentLine(options);
  const body = [
    'AIM4PRICE ASSET DETAILS',
    ...(shareableAssets.length > 1 ? [safeShareName, `${shareableAssets.length} assets`] : []),
    '',
    ...shareableAssets.flatMap((asset, index) => [
      ...buildAssetBlock(asset, index, shareableAssets.length > 1),
      ...(index < shareableAssets.length - 1 ? ['', '------------------------------', ''] : []),
    ]),
    ...(attachmentLine ? ['', attachmentLine] : []),
    '',
    'Shared from Aim4price. Values are saved estimates and remain subject to inspection.',
  ].filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''));

  return {
    subject,
    body: body.join('\n').trim(),
  };
}

export function buildWhatsAppShareUrl(copy: ExternalAssetShareCopy): string {
  return `https://wa.me/?text=${encodeURIComponent(copy.body)}`;
}

export function buildEmailShareUrl(copy: ExternalAssetShareCopy): string {
  return `mailto:?subject=${encodeURIComponent(copy.subject)}&body=${encodeURIComponent(copy.body)}`;
}
