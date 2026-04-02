'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  clearItems,
  deleteItem,
  loadItems,
  saveItem,
  type SavedItem,
} from '../../lib/register';
import {
  loadPublishedMarketplaceListings,
  publishRegisterItemToMarketplace,
  removeMarketplaceListing,
} from '../../lib/marketplace';
import { money } from '../../lib/tractor-logic';

type NoticeTone = 'success' | 'error';

function cleanOptional(value: string | null): string | undefined {
  const next = String(value ?? '').trim();
  return next || undefined;
}

function parseMoney(value: string): number {
  return Number(String(value).replace(/[^0-9.]/g, ''));
}

export default function RegisterPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [publishedAssetIds, setPublishedAssetIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<NoticeTone>('success');

  useEffect(() => {
    refresh();
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.selectedValueExVat || 0), 0),
    [items],
  );

  function setNotice(text: string, tone: NoticeTone = 'success') {
    setMessage(text);
    setMessageTone(tone);
  }

  function refresh() {
    setItems(loadItems());

    const published = loadPublishedMarketplaceListings()
      .map((listing) => listing.sourceAssetId)
      .filter((value): value is string => Boolean(value));

    setPublishedAssetIds(published);
  }

  function add() {
    const parsed = parseMoney(value);

    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setNotice('Give the manual asset a title and value first.', 'error');
      return;
    }

    saveItem({
      id: `manual-${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      kind: 'manual',
      title: title.trim(),
      selectedMethod: 'manual',
      selectedValueExVat: Math.round(parsed),
      note: 'Manual asset',
      createdAtIso: new Date().toISOString(),
    });

    setTitle('');
    setValue('');
    refresh();
    setNotice('Manual asset added.');
  }

  function editValue(item: SavedItem) {
    const raw = window.prompt('New value', String(item.selectedValueExVat));
    if (raw === null) return;

    const parsed = parseMoney(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setNotice('Enter a valid value greater than zero.', 'error');
      return;
    }

    saveItem({
      ...item,
      selectedMethod: 'manual',
      selectedValueExVat: Math.round(parsed),
    });

    refresh();
    setNotice(`${item.title} updated.`);
  }

  function removeItem(item: SavedItem) {
    const confirmed = window.confirm(`Delete "${item.title}" from the asset register?`);
    if (!confirmed) return;

    deleteItem(item.id);

    if (item.kind === 'tractor') {
      removeMarketplaceListing(`market-${item.id}`);
    }

    refresh();
    setNotice(`${item.title} deleted.`);
  }

  function publishToMarketplace(item: SavedItem) {
    if (item.kind !== 'tractor') {
      setNotice('Only tractor assets can be sent to marketplace.', 'error');
      return;
    }

    const area = window.prompt('Area / town', '');
    if (area === null || !area.trim()) {
      setNotice('Area is required before publishing.', 'error');
      return;
    }

    const province = window.prompt('Province', '');
    if (province === null || !province.trim()) {
      setNotice('Province is required before publishing.', 'error');
      return;
    }

    const sellerName = window.prompt('Seller name', 'Aim4price Seller');
    if (sellerName === null || !sellerName.trim()) {
      setNotice('Seller name is required before publishing.', 'error');
      return;
    }

    const sellerPhone = window.prompt('Seller phone number', '');
    if (sellerPhone === null || !sellerPhone.trim()) {
      setNotice('Seller phone number is required before publishing.', 'error');
      return;
    }

    const priceRaw = window.prompt(
      'Asking price (VAT excluded)',
      String(Math.round(item.selectedValueExVat || 0)),
    );
    if (priceRaw === null) return;

    const askingPriceExVat = parseMoney(priceRaw);
    if (!Number.isFinite(askingPriceExVat) || askingPriceExVat <= 0) {
      setNotice('Enter a valid asking price greater than zero.', 'error');
      return;
    }

    const sellerCompany = window.prompt('Seller company (optional)', '');
    if (sellerCompany === null) return;

    const sellerEmail = window.prompt('Seller email (optional)', '');
    if (sellerEmail === null) return;

    const description = window.prompt(
      'Short description (optional)',
      `${item.brandName ?? 'Tractor'} ${item.modelName ?? ''} available on the Aim4price marketplace.`,
    );
    if (description === null) return;

    const imageSrc = window.prompt(
      'Photo URL (optional). Leave blank to use the generic tractor image.',
      '',
    );
    if (imageSrc === null) return;

    try {
      publishRegisterItemToMarketplace(item, {
        area,
        province,
        askingPriceExVat: Math.round(askingPriceExVat),
        sellerName,
        sellerCompany: cleanOptional(sellerCompany),
        sellerPhone,
        sellerEmail: cleanOptional(sellerEmail),
        description: cleanOptional(description),
        imageSrc: cleanOptional(imageSrc),
      });

      refresh();
      setNotice(`${item.title} sent to marketplace.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Unable to publish this asset to marketplace.',
        'error',
      );
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.wrap}>
        <div>
          <h1>Asset Register</h1>
          <p>
            The total uses the chosen value from each saved row. Everything is VAT excluded. Tractor
            assets can also be sent to the Aim4price marketplace from here.
          </p>
        </div>
        <div className={styles.total}>{money(total)}</div>
      </section>

      <section className={styles.layout}>
        <article className={styles.card}>
          <div className={styles.rowBetween}>
            <div>
              <h2>Saved Assets</h2>
              <p>
                Tractor rows keep the valuation values. Manual rows let you add houses or other
                items. Marketplace upload is only available for tractor assets.
              </p>
            </div>

            {items.length ? (
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm('Clear all saved items from the asset register?');
                  if (!confirmed) return;

                  clearItems();
                  refresh();
                  setNotice('Asset register cleared.');
                }}
                className={styles.secondary}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className={styles.list}>
            {items.length ? (
              items.map((item) => {
                const isPublished = publishedAssetIds.includes(item.id);

                return (
                  <div key={item.id} className={styles.item}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.kind === 'tractor'
                          ? `${item.brandName} · ${item.modelName}${
                              item.yearModel ? ` · ${item.yearModel}` : ''
                            }${item.hours ? ` · ${item.hours.toLocaleString('en-ZA')} hrs` : ''}`
                          : item.note || 'Manual asset'}
                      </span>

                      {item.kind === 'tractor' ? (
                        <div
                          style={{
                            marginTop: '0.45rem',
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            color: isPublished ? '#1d6b46' : 'var(--text-muted)',
                          }}
                        >
                          {isPublished ? 'Marketplace live' : 'Not yet on marketplace'}
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.itemRight}>
                      <strong>{money(item.selectedValueExVat)}</strong>
                      <span>{item.selectedMethod.toUpperCase()}</span>
                    </div>

                    <div className={styles.itemActions}>
                      {item.kind === 'tractor' ? (
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={() => publishToMarketplace(item)}
                        >
                          {isPublished ? 'Update Marketplace' : 'Send to Marketplace'}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => editValue(item)}
                      >
                        Edit Value
                      </button>

                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => removeItem(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.empty}>
                No saved items yet. Save a tractor from the valuation page first.
              </div>
            )}
          </div>
        </article>

        <aside className={styles.card}>
          <h2>Add Manual Asset</h2>

          <label>Title</label>
          <input
            value={title}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
            placeholder="Farm house"
          />

          <label>Value (VAT excluded)</label>
          <input
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setValue(event.target.value.replace(/[^0-9]/g, ''))
            }
            placeholder="2500000"
          />

          <button type="button" className={styles.primary} onClick={add}>
            Add to Register
          </button>

          {message ? (
            <div
              className={styles.message}
              style={
                messageTone === 'error'
                  ? {
                      background: 'rgba(177, 38, 38, 0.1)',
                      color: '#8e1f1f',
                    }
                  : undefined
              }
            >
              {message}
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
