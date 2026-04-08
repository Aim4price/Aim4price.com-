'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  clearItems,
  deleteItem,
  loadItems,
  saveItem,
  type SavedItem,
  type SavedItemKind,
  type SavedItemMethod,
} from '../../lib/register';
import {
  loadPublishedMarketplaceListings,
  publishRegisterItemToMarketplace,
  removeMarketplaceListing,
  type MarketplaceListing,
} from '../../lib/marketplace';
import { money } from '../../lib/tractor-logic';

type NoticeTone = 'success' | 'error';
type AssetFilter = 'all' | 'tractor' | 'manual' | 'property' | 'live';
type EditorMode = 'add' | 'edit';

type RegisterAsset = SavedItem & {
  serialNumber?: string;
  isFinanced?: boolean;
  financeNote?: string;
  photos?: string[];
  sellerPhone?: string;
  marketplaceNotes?: string;
};

type AssetDraft = {
  kind: SavedItemKind;
  title: string;
  value: string;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  financeNote: string;
  photos: string[];
};

const DEFAULT_MARKETPLACE_SELLER = 'Aim4price Seller';
const DEFAULT_MARKETPLACE_AREA = 'Seller Location';
const DEFAULT_MARKETPLACE_PROVINCE = 'South Africa';
const MAX_PHOTOS = 8;

function createAssetDraft(kind: SavedItemKind = 'manual'): AssetDraft {
  return {
    kind,
    title: '',
    value: '',
    note: '',
    serialNumber: '',
    isFinanced: false,
    financeNote: '',
    photos: [],
  };
}

function parseMoney(value: string): number {
  return Number(String(value).replace(/[^0-9.]/g, ''));
}

function methodLabel(value: SavedItemMethod): string {
  return (
    {
      aim4price: 'Aim4price',
      market: 'Market',
      department: 'Department',
      manual: 'Manual Override',
    }[value] ?? 'Manual Override'
  );
}

function typeShortLabel(value: SavedItemKind): string {
  return (
    {
      tractor: 'Equipment',
      manual: 'Manual',
      property: 'Property',
    }[value] ?? 'Manual'
  );
}

function filterLabel(value: AssetFilter): string {
  return (
    {
      all: 'All Assets',
      tractor: 'Equipment',
      property: 'Property',
      manual: 'Manual Assets',
      live: 'Marketplace Live',
    }[value] ?? 'All Assets'
  );
}

function normaliseRegisterItem(item: SavedItem): RegisterAsset {
  const raw = item as RegisterAsset;

  return {
    ...raw,
    serialNumber: raw.serialNumber ?? '',
    isFinanced: Boolean(raw.isFinanced),
    financeNote: raw.financeNote ?? '',
    photos: Array.isArray(raw.photos) ? raw.photos.filter(Boolean) : [],
    sellerPhone: raw.sellerPhone ?? '',
    marketplaceNotes: raw.marketplaceNotes ?? '',
  };
}

function formatItemMeta(item: RegisterAsset): string {
  if (item.kind !== 'tractor') {
    return item.note || 'Added manually to the register';
  }

  const parts = [
    item.brandName,
    item.modelName,
    item.yearModel ? String(item.yearModel) : undefined,
  ];

  if (item.hours) {
    parts.push(`${item.hours.toLocaleString('en-ZA')} hours`);
  }

  return parts.filter(Boolean).join(' · ') || 'Saved from valuation';
}

function formatDateLabel(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function timeAgo(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  const elapsed = Date.now() - parsed.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < hour) {
    const minutes = Math.max(1, Math.round(elapsed / minute));
    return `${minutes} min ago`;
  }

  if (elapsed < day) {
    const hours = Math.max(1, Math.round(elapsed / hour));
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.max(1, Math.round(elapsed / day));
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function matchesSearch(item: RegisterAsset, query: string): boolean {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  const haystack = [
    item.title,
    item.brandName,
    item.modelName,
    item.note,
    item.kind,
    item.tractorType,
    item.drive,
    item.serialNumber,
    item.financeNote,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

async function filesToDataUrls(files: FileList | null): Promise<string[]> {
  if (!files?.length) {
    return [];
  }

  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
              return;
            }

            reject(new Error('Could not read the image.'));
          };

          reader.onerror = () => reject(new Error('Could not read the image.'));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function assetDetails(item: RegisterAsset, isLive: boolean) {
  const tractorExtras = item as RegisterAsset & { cab?: boolean };

  const base = [
    { label: 'Serial', value: item.serialNumber || '—' },
    { label: 'Finance', value: item.isFinanced ? 'Financed' : 'Not financed' },
    { label: 'Photos', value: String(item.photos?.length ?? 0) },
    { label: 'Marketplace', value: isLive ? 'Live' : 'Not live' },
  ];

  if (item.kind !== 'tractor') {
    return [
      ...base,
      { label: 'Type', value: typeShortLabel(item.kind) },
      { label: 'Added', value: formatDateLabel(item.createdAtIso) },