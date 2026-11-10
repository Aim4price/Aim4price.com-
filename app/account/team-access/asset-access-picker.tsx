'use client';

import OwnerAccessPicker, { type AccessChoice } from '../owner-access-picker';

type Option = AccessChoice & { count?: number };
export default function AssetAccessPicker({ kind, options, selected, onClose, onConfirm }: {
  kind: 'umbrellas' | 'registers' | 'assets';
  options: Option[];
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  return <OwnerAccessPicker standardAssets={kind === 'assets'} compact title={`Choose ${kind}`} description={kind === 'umbrellas' ? 'Add the current assets in each umbrella.' : kind === 'registers' ? 'Include current and future assets in these registers.' : 'Choose the individual assets they can access.'} options={options.map(option => ({ ...option, detail: [option.detail, option.count === undefined ? '' : `${option.count} assets`].filter(Boolean).join(' · ') }))} selected={selected} onClose={onClose} onConfirm={onConfirm}/>;
}
