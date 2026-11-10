export type AssetAccessOption = { id: string; title: string; kind?: string; registerId?: string | null; registerName?: string; yearModel?: number | null; serialNumber?: string; usage?: number | null; usageMetric?: 'hours' | 'km' | 'percentage' | 'not_applicable' };
export function assetAccessChoice(asset: AssetAccessOption) {
  const usage = typeof asset.usage === 'number' && asset.usageMetric && asset.usageMetric !== 'not_applicable'
    ? `Usage: ${asset.usage.toLocaleString('en-ZA')}${asset.usageMetric === 'percentage' ? '%' : ` ${asset.usageMetric}`}` : '';
  return {
    id: asset.id, title: asset.title,
    detail: [asset.kind ? asset.kind.charAt(0).toUpperCase() + asset.kind.slice(1) : 'Asset', asset.registerName].filter(Boolean).join(' · '),
    meta: [asset.yearModel ? `Year Model: ${asset.yearModel}` : '', usage].filter(Boolean).join(' · '),
    serialNumber: asset.serialNumber,
  };
}

