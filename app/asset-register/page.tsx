'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import styles from './page.module.css';
import { clearItems, deleteItem, loadItems, saveItem, type SavedItem } from '../../lib/register';
import { money } from '../../lib/tractor-logic';

export default function RegisterPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setItems(loadItems());
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.selectedValueExVat || 0), 0),
    [items],
  );

  function refresh() {
    setItems(loadItems());
  }

  function add() {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));

    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setMessage('Give the manual asset a title and value first.');
      return;
    }

    saveItem({
      id: `manual-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
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
    setMessage('Manual asset added.');
  }

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          ← Aim4price
        </Link>
        <nav className={styles.nav}>
          <Link href="/valuation">Valuation</Link>
          <Link href="/asset-register" className={styles.active}>
            Asset Register
          </Link>
          <Link href="/marketplace">Marketplace</Link>
        </nav>
      </header>

      <section className={styles.wrap}>
        <div>
          <h1>Asset Register</h1>
          <p>The total uses the chosen value from each saved row. Everything is VAT excluded.</p>
        </div>
        <div className={styles.total}>{money(total)}</div>
      </section>

      <section className={styles.layout}>
        <article className={styles.card}>
          <div className={styles.rowBetween}>
            <div>
              <h2>Saved Assets</h2>
              <p>Tractor rows keep the 3 method numbers. Manual rows let you add houses or other items.</p>
            </div>
            {items.length ? (
              <button
                type="button"
                onClick={() => {
                  clearItems();
                  refresh();
                }}
                className={styles.secondary}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className={styles.list}>
            {items.length ? (
              items.map((item) => (
                <div key={item.id} className={styles.item}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.kind === 'tractor' ? `${item.brandName} · ${item.modelName}` : item.note || 'Manual asset'}</span>
                  </div>

                  <div className={styles.itemRight}>
                    <strong>{money(item.selectedValueExVat)}</strong>
                    <span>{item.selectedMethod.toUpperCase()}</span>
                  </div>

                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => {
                        const raw = window.prompt('New value', String(item.selectedValueExVat));
                        if (raw === null) return;

                        const parsed = Number(raw.replace(/[^0-9.]/g, ''));
                        if (!Number.isFinite(parsed) || parsed <= 0) return;

                        saveItem({
                          ...item,
                          selectedMethod: 'manual',
                          selectedValueExVat: Math.round(parsed),
                        });
                        refresh();
                      }}
                    >
                      Edit value
                    </button>

                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => {
                        deleteItem(item.id);
                        refresh();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No saved items yet. Save a tractor from the valuation page first.</div>
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
          {message ? <div className={styles.message}>{message}</div> : null}
        </aside>
      </section>
    </main>
  );
}
