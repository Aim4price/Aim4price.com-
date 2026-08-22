'use client';

import styles from './DealerAssetShareSelection.module.css';

export type DealerShareAssetOption = {
  id: string;
  title: string;
  yearModel: number | null;
  serialNumber: string;
  registrationNumber: string;
};

type DealerAssetShareSelectionProps = {
  assets: DealerShareAssetOption[];
  selectedAssetIds: string[];
  onChange: (assetIds: string[]) => void;
  disabled?: boolean;
};

export default function DealerAssetShareSelection({
  assets,
  selectedAssetIds,
  onChange,
  disabled = false,
}: DealerAssetShareSelectionProps) {
  const selectedIds = new Set(selectedAssetIds);
  const allSelected = assets.length > 0 && assets.every((asset) => selectedIds.has(asset.id));

  function toggleAsset(assetId: string) {
    const next = new Set(selectedAssetIds);
    if (next.has(assetId)) next.delete(assetId);
    else next.add(assetId);
    onChange(assets.filter((asset) => next.has(asset.id)).map((asset) => asset.id));
  }

  return (
    <section className={styles.panel} aria-labelledby="dealer-share-assets-title" data-asset-choice-surface="true">
      <div className={styles.header} data-asset-choice-header="true">
        <div>
          <h5 id="dealer-share-assets-title">Assets to share</h5>
          <p>{selectedAssetIds.length} of {assets.length} selected</p>
        </div>
        <button
          type="button"
          className={styles.selectAllButton}
          onClick={() => onChange(allSelected ? [] : assets.map((asset) => asset.id))}
          disabled={disabled || !assets.length}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <div className={styles.list} data-asset-choice-list="true">
        {assets.map((asset) => {
          const checked = selectedIds.has(asset.id);
          const details = [
            asset.yearModel ? String(asset.yearModel) : '',
            asset.serialNumber ? `Serial ${asset.serialNumber}` : '',
            asset.registrationNumber ? `Reg ${asset.registrationNumber}` : '',
          ].filter(Boolean);

          return (
            <label
              key={asset.id}
              className={`${styles.assetRow} ${checked ? styles.assetRowSelected : ''}`}
              data-asset-choice-row="true"
              data-asset-choice-selected={checked ? 'true' : undefined}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleAsset(asset.id)}
                disabled={disabled}
              />
              <span className={styles.checkbox} aria-hidden="true">{checked ? '✓' : ''}</span>
              <span className={styles.assetCopy} data-asset-choice-copy="true">
                <strong>{asset.title}</strong>
                {details.length ? <small data-asset-choice-meta="true">{details.join(' · ')}</small> : null}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

