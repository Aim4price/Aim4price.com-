import { DetailIcon } from './PartsDetailFields';
import styles from '../app/dealer/parts/parts.module.css';

type Card<T> = {
  id: T; label: string; visible: boolean; locked?: boolean; hint: string;
  count: number; canDelete?: boolean; deleteHint?: string;
};
type Props<T> = {
  cards: Card<T>[]; page: number; onPage: (page: number) => void;
  onToggle: (id: T, visible: boolean) => void;
  onAction: (id: T, kind: 'clear' | 'delete') => void;
  lockedCaption?: string;
};

export default function SheetColumnCards<T extends string | number>({ cards, page, onPage, onToggle, onAction, lockedCaption = 'Required column' }: Props<T>) {
  const pages = Math.ceil(cards.length / 6);
  return <>
    <div className={styles.columnIntro}><p tabIndex={-1} data-column-heading>Choose which columns to show.</p><span>Hidden values are kept.</span></div>
    <div className={styles.manageColumns}>{cards.slice(page * 6, page * 6 + 6).map(card =>
      <div key={card.id} className={styles.manageColumnRow}>
        <label><input type="checkbox" aria-label={card.label} checked={card.visible} disabled={card.locked}
          onChange={e => onToggle(card.id, e.target.checked)} />
          <span><strong title={card.label}>{card.label}</strong><small>{card.hint}</small></span>
        </label>
        <div className={styles.columnCardActions}>
          {card.locked ? <span>{lockedCaption}</span> : <>
            <button type="button" aria-label={`Clear ${card.label} values`} disabled={!card.count} onClick={() => onAction(card.id, 'clear')}>Clear values</button>
            <button type="button" className={styles.detailTrash} aria-label={`Delete ${card.label} column`} title={card.deleteHint || 'Delete column'}
              disabled={card.canDelete === false} onClick={() => onAction(card.id, 'delete')}><DetailIcon kind="delete" /></button>
          </>}
        </div>
      </div>)}</div>
    {pages > 1 && <nav className={styles.bulkPager} aria-label="Column pages">
      <button type="button" disabled={!page} onClick={() => onPage(page - 1)}>Previous columns</button>
      <span>{page + 1} / {pages}</span>
      <button type="button" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next columns</button>
    </nav>}
  </>;
}
