import type { SectorKey } from './equipment-types';

export type OptionMode = 'basic' | 'advanced' | 'both';
export type AssetOption = {
  id: string;
  label: string;
  sector: SectorKey;
  mode: OptionMode;
  archived: boolean;
  version: number;
};
