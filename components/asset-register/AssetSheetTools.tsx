'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { columnLabel, isCustomColumn, customColumn, maxCustomColumns, hasAssetData, assetTitle, columns, type CustomColumn, type BuiltInColumn, type AssetRow, type Column } from '../../lib/asset-sheet';
import css from './AssetSheetDialog.module.css';
import type { AssetDraft } from './AssetSheetEditor';
import SheetColumnCards from '../SheetColumnCards';
import styles from '../../app/dealer/parts/parts.module.css';
import { DetailIcon } from '../PartsDetailFields';
import PartsChoice from '../PartsChoice';
import Select from '../AssetModalSelect';
import ShareModalCloseButton from './ShareModalCloseButton';

export type AssetTool = { kind: 'columns' | 'bulk' } | { kind: 'row'; index: number };

const fieldPresentation: Record<BuiltInColumn, { icon: string; hint: string }> = {
  title: { icon: 'description', hint: 'Name used in the register' },
  make: { icon: 'brand', hint: 'Brand or manufacturer' },
  model: { icon: 'partNumber', hint: 'Model name or number' },
  category: { icon: 'type', hint: 'Type of asset' },
  year: { icon: 'calendar', hint: 'Year of manufacture' },
  serial: { icon: 'partNumber', hint: 'Serial or chassis number' },
  usage: { icon: 'gauge', hint: 'Current usage reading' },
  unit: { icon: 'ruler', hint: 'Hours, km or percent' },
  condition: { icon: 'condition', hint: 'Overall condition of the asset' },
  replacement: { icon: 'price', hint: 'Cost to replace the asset' },
  registration: { icon: 'partNumber', hint: 'Number plate or registration' },
  license: { icon: 'condition', hint: 'Whether the asset is licensed' },
  finance: { icon: 'condition', hint: 'Whether the asset is financed' },
  financeNote: { icon: 'notes', hint: 'Details about the finance agreement' },
  insurance: { icon: 'condition', hint: 'Whether the asset is insured' },
  insuredValue: { icon: 'price', hint: 'Amount covered by insurance' },
  insuranceNote: { icon: 'notes', hint: 'Details about the insurance cover' },
  note: { icon: 'notes', hint: 'Notes to keep with the asset' },
  value: { icon: 'price', hint: 'Current value in rand' },
};

type Props = {
  tool: AssetTool;
  register: string;
  rows: AssetRow[];
  visible: Column[];
  selected: number[];
  custom: CustomColumn[];
  savedColumns: CustomColumn[];
  onChange: (draft: Partial<AssetDraft>) => void;
  onRows: (rows: AssetRow[], reveal?: Column) => void;
  onMove: (field: Column, direction: number) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
};

export default function AssetSheetTools({ tool: initialTool, register, rows, visible, selected, custom, savedColumns, onChange, onRows, onMove, onRemove, onClose }: Props) {
  const [tool, setTool] = useState<AssetTool | { kind: 'add' | 'order' }>(initialTool);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const allColumns = [...columns, ...custom];
  const availableCustom = [...new Set([...custom, ...savedColumns])].filter(k => !visible.includes(k));
  const [choice, setChoice] = useState<Column | 'new' | ''>('');
  const [name, setName] = useState('');
  const [action, setAction] = useState<{ key: Column; kind: 'clear' | 'delete' } | null>(null);
  const [error, setError] = useState('');
  const [columnPage, setColumnPage] = useState(0);
  const [scope, setScope] = useState(selected.length ? 'selected' : 'all');
  const [field, setField] = useState<Column>('make');
  const [operation, setOperation] = useState('replace');
  const [value, setValue] = useState('');
  const [step, setStep] = useState(0);
  const [remove, setRemove] = useState(false);
  const [row, setRow] = useState(tool.kind === 'row' ? rows[tool.index] : null);

  useEffect(() => {
    const opener = document.activeElement;
    const el = dialog.current;
    el?.showModal();
    return () => {
      el?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [tool.kind, step, remove, action, columnPage]);

  const targets = scope === 'selected' ? selected : rows.flatMap((r, i) => hasAssetData(r) ? [i] : []);
  const nextValue = operation === 'clear' ? '' : value.trim();
  const changed = targets.filter(i => (rows[i][field] ?? '') !== nextValue && (operation !== 'fill' || !(rows[i][field] || '').trim()));
  const bulkSteps = ['Choose assets', 'Choose a column', 'Enter the change', 'Preview changes'];
  const title = tool.kind === 'row' ? (remove ? 'Remove row ' : 'Edit row ') + (tool.index + 1) : { add: 'Add column', columns: 'Columns', order: 'Reorder columns', bulk: 'Bulk edit' }[tool.kind];
  function addColumn() {
    if (!choice) return;
    try {
      const entered = choice === 'new' ? customColumn(name, custom) : choice;
      const key = savedColumns.find(k => k.toLowerCase() === entered.toLowerCase()) ?? entered;
      const next = [...visible, key];
      if (key === 'usage' && !next.includes('unit')) next.push('unit');
      onChange({ visible: next, custom: isCustomColumn(key) && !custom.includes(key) ? [...custom, key] : custom });
      onClose();
    } catch (cause) { setError((cause as Error).message); }
  }
  const affects = (index: number) => action?.kind === 'delete' || scope === 'all' || selected.includes(index);
  const affected = action ? rows.filter((r, i) => affects(i) && r[action.key]?.trim()).length : 0;
  function applyColumnAction() {
    if (!action || action.key === 'title') return;
    const { key, kind } = action;
    const nextRows = rows.map((r, i) => {
      if (!affects(i)) return r;
      const next = { ...r };
      if (kind === 'delete' && isCustomColumn(key)) delete next[key];
      else next[key] = '';
      return next;
    });
    onChange(kind === 'delete' ? { rows: nextRows, visible: visible.filter(k => k !== key), custom: custom.filter(k => k !== key) } : { rows: nextRows });
    onClose();
  }
  function applyBulk() {
    const indexes = new Set(changed);
    onRows(rows.map((r, i) => indexes.has(i) ? { ...r, [field]: nextValue } : r), field);
    onClose();
  }
  const toolStyle = tool.kind === 'add' ? [styles.detailPicker, styles.marketplaceChoiceModal, styles.columnPicker].join(' ')
    : tool.kind === 'columns' ? styles.columnsDialog : '';
  return createPortal(<dialog ref={dialog} className={`${styles.modal} ${styles.sheetToolDialog} ${toolStyle}`} aria-labelledby="asset-sheet-tool-title"
    onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className={styles.sheetToolHeader}><div><h2 ref={heading} tabIndex={-1} id="asset-sheet-tool-title">{title}</h2>{tool.kind !== 'columns' && <p>{tool.kind === 'add' ? 'Optional information for this asset register' : register}</p>}</div>
      <ShareModalCloseButton aria-label={'Close ' + title} onClick={onClose} /></header>
    <div className={styles.sheetToolBody} data-columns-body={tool.kind === 'columns' || undefined}>
      {tool.kind === 'add' && (!choice ? <>
        <div className={styles.detailPickerChoices}>{columns.filter(k => !visible.includes(k)).map(k =>
          <button key={k} type="button" data-detail={k} aria-label={columnLabel(k)} disabled={visible.includes(k)} onClick={() => setChoice(k)}>
            <DetailIcon kind={fieldPresentation[k].icon} /><span><strong>{columnLabel(k)}</strong><small>{fieldPresentation[k].hint}</small></span>
          </button>)}
          <button type="button" data-detail="custom" disabled={custom.length >= maxCustomColumns} onClick={() => setChoice('new')}>
            <DetailIcon kind="custom" /><span><strong>Custom field</strong><small>Choose your own field name</small></span>
          </button>
        </div>
        {!!availableCustom.length && <section className={styles.detailRestoreInputs}><h3>Custom fields in this register</h3>
          <div className={styles.detailPickerChoices}>{availableCustom.map(k => <button key={k} type="button"
            disabled={!custom.includes(k) && custom.length >= maxCustomColumns} onClick={() => setChoice(k)}>
            <DetailIcon kind="restore" /><span><strong>{columnLabel(k)}</strong><small>Add to this sheet</small></span></button>)}</div>
        </section>}
      </> : <>
        <div className={styles.detailSelection}><DetailIcon kind={choice === 'new' || isCustomColumn(choice) ? 'custom' : fieldPresentation[choice].icon} />
          <div><strong>{choice === 'new' ? 'Custom field' : columnLabel(choice)}</strong>
            <p>{choice === 'new' ? 'Choose a name that is clear to your team.' : 'Add this column to your sheet.'}</p></div>
          <button type="button" onClick={() => { setChoice(''); setError(''); }}>Change</button>
        </div>
        {choice === 'new' && <div className={styles.detailFieldSettings}><label>Field name<input autoFocus aria-label="Custom field name"
          maxLength={60} value={name} placeholder="e.g. Insurance reference" onChange={e => { setName(e.target.value); setError(''); }} /></label></div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </>)}
      {tool.kind === 'columns' && !action && <div className={css.columnTools}>
        <button type="button" onClick={() => { setChoice(''); setError(''); setTool({ kind: 'add' }); }}>Add column</button>
        <button type="button" disabled={visible.length < 2} onClick={() => setTool({ kind: 'order' })}>Reorder columns</button>
      </div>}
      {tool.kind === 'order' && <ol className={css.orderList}>{visible.map((key, index) =>
        <li key={key}>
          <strong>{columnLabel(key)}</strong>
          {([-1, 1] as const).map(direction => {
            const side = direction === -1 ? 'left' : 'right';
            return <button key={side} type="button" disabled={index + direction < 0 || index + direction >= visible.length}
              aria-label={'Move ' + columnLabel(key) + ' ' + side} onClick={event => {
                const row = event.currentTarget.parentElement;
                onMove(key, direction);
                requestAnimationFrame(() => {
                  const button = row?.querySelector<HTMLButtonElement>('button[aria-label$="' + side + '"]:enabled')
                    ?? row?.querySelector<HTMLButtonElement>('button:enabled');
                  button?.focus();
                });
              }}>Move {side}</button>;
          })}
        </li>)}</ol>}
      {tool.kind === 'columns' && (action ? <section className={styles.columnActionStage}>
        <div className={styles.columnActionHeading}><DetailIcon kind="delete" /><div><h3>{action.kind === 'clear' ? 'Clear values?' : 'Delete column?'}</h3><p>{columnLabel(action.key)}</p></div></div>
        {action.kind === 'clear' && <PartsChoice label="Clear values for" value={scope} onChange={setScope}
          options={[{value:'selected',label:`Selected assets (${selected.length})`,disabled:!selected.length},{value:'all',label:'All assets in this sheet'}]} />}
        <div className={styles.columnImpact}><strong>{affected} {affected === 1 ? 'asset' : 'assets'} affected</strong>
          <p>{action.kind === 'delete' ? 'Removes this column and its values from the draft sheet.' : 'Clears these values. The column stays in your sheet.'}</p></div>
        <p className={styles.bulkHint}>You can undo this before saving the sheet.</p>
      </section> : <SheetColumnCards page={columnPage} onPage={setColumnPage} lockedCaption="Identity column"
        cards={allColumns.map(k => {
          const count = rows.filter(r => r[k]?.trim()).length;
          return { id:k, label:columnLabel(k), count, locked:k === 'title', visible:visible.includes(k),
            hint:k === 'title' ? 'Always visible' : `${count} ${count === 1 ? 'asset' : 'assets'} with values` };
        })} onToggle={(k, show) => onChange({ visible: show ? [...visible,k] : visible.filter(v => v !== k) })}
        onAction={(key, kind) => setAction({key,kind})} />)}
      {tool.kind === 'row' && row && (remove ? <p>Remove {assetTitle(row) || 'row ' + (tool.index + 1)} from this draft sheet?</p> :
        <div className={styles.sheetToolFields}>{visible.map(k => <label key={k}>{columnLabel(k)}
          <input value={row[k] ?? ''} onChange={e => setRow({ ...row, [k]: e.target.value })} /></label>)}</div>)}
      {tool.kind === 'bulk' && <>
        <h3>{bulkSteps[step]}</h3>
        {step === 0 && <PartsChoice label="Apply to" value={scope} onChange={setScope} options={[
          { value: 'all', label: 'All populated rows' }, ...(selected.length ? [{ value: 'selected', label: 'Selected rows (' + selected.length + ')' }] : []),
        ]} />}
        {step === 1 && <Select label="Asset field" usePortal={false} value={field} options={allColumns.map(k => ({ value: k, label: columnLabel(k) }))} onChange={setField} />}
        {step === 2 && <>
          <PartsChoice label={columnLabel(field)} value={operation} onChange={setOperation} options={[
            { value: 'replace', label: 'Replace values' }, { value: 'fill', label: 'Fill empty cells' }, { value: 'clear', label: 'Clear values' },
          ]} />
          {operation !== 'clear' && <label>New value<input value={value} onChange={e => setValue(e.target.value)} /></label>}
        </>}
        {step === 3 && <><p>{changed.length} {changed.length === 1 ? 'row' : 'rows'} will change in the {columnLabel(field)} column.</p>
          <div className={styles.tableWrap}><table><thead><tr><th>Row</th><th>Current value</th><th>New value</th></tr></thead>
            <tbody>{changed.map(i => <tr key={i}><th>{i + 1}</th><td>{rows[i][field] || 'Empty'}</td><td>{nextValue || 'Empty'}</td></tr>)}</tbody></table></div></>}
      </>}
    </div>
    <footer className={styles.sheetToolFooter}>
      {(tool.kind === 'order' || tool.kind === 'add') && <button onClick={() => setTool({ kind: 'columns' })}>Back to columns</button>}
      {(tool.kind === 'row' || tool.kind === 'bulk') && <button onClick={onClose}>Cancel</button>}
      {tool.kind === 'order' && <button className={styles.primary} onClick={onClose}>Done</button>}
      {tool.kind === 'add' && <button className={styles.primary} disabled={!choice || (choice === 'new' && !name.trim())} onClick={addColumn}>Next</button>}
      {tool.kind === 'columns' && (action ? <><button onClick={() => setAction(null)}>Back</button>
        <button className={styles.sheetDelete} disabled={action.kind === 'clear' && !affected} onClick={applyColumnAction}>
          {action.kind === 'clear' ? 'Clear values in sheet' : 'Delete column from sheet'}</button></> : <button className={styles.primary} onClick={onClose}>Done</button>)}
      {tool.kind === 'row' && row && (remove ? <button className={styles.sheetDelete} onClick={() => { onRemove(tool.index); onClose(); }}>Remove from sheet</button> :
        <><button className={styles.sheetDelete} onClick={() => setRemove(true)}>Remove row</button>
          <button className={styles.primary} onClick={() => { onRows(rows.map((r, i) => i === tool.index ? row : r)); onClose(); }}>Apply changes</button></>)}
      {tool.kind === 'bulk' && <>
        {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3 ? <button className={styles.primary} disabled={!targets.length || (step === 2 && (!changed.length || (operation !== 'clear' && !value.trim())))} onClick={() => setStep(step + 1)}>{step === 2 ? 'Preview changes' : 'Continue'}</button> :
          <button className={styles.primary} disabled={!changed.length} onClick={applyBulk}>Apply to {changed.length} {changed.length === 1 ? 'row' : 'rows'}</button>}
      </>}
    </footer>
  </dialog>, document.body);
}
