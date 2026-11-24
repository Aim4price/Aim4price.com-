'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { assetColumns, assetTitle, columns, type AssetRow, type Column } from '../../lib/asset-sheet';
import styles from '../../app/dealer/parts/parts.module.css';
import { DetailIcon } from '../PartsDetailFields';
import PartsChoice from '../PartsChoice';
import Select from '../AssetModalSelect';
import ShareModalCloseButton from './ShareModalCloseButton';

export type AssetTool = { kind: 'add' | 'columns' | 'bulk' } | { kind: 'row'; index: number };

const fieldPresentation: Record<Column, { icon: string; hint: string }> = {
  title: { icon: 'description', hint: 'Name used in the register' },
  make: { icon: 'brand', hint: 'Brand or manufacturer' },
  model: { icon: 'partNumber', hint: 'Model name or number' },
  category: { icon: 'type', hint: 'Type of asset' },
  year: { icon: 'calendar', hint: 'Year of manufacture' },
  serial: { icon: 'partNumber', hint: 'Serial or chassis number' },
  usage: { icon: 'gauge', hint: 'Current usage reading' },
  unit: { icon: 'ruler', hint: 'Hours, km or percent' },
  value: { icon: 'price', hint: 'Current value in rand' },
};

type Props = {
  tool: AssetTool;
  register: string;
  rows: AssetRow[];
  visible: Column[];
  selected: number[];
  onColumns: (fields: Column[]) => void;
  onRows: (rows: AssetRow[], reveal?: Column) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
};

export default function AssetSheetTools({ tool, register, rows, visible, selected, onColumns, onRows, onRemove, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [fields, setFields] = useState(visible);
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
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step, remove]);

  const targets = scope === 'selected' ? selected : rows.flatMap((r, i) => columns.some(k => r[k].trim()) ? [i] : []);
  const nextValue = operation === 'clear' ? '' : value.trim();
  const changed = targets.filter(i => rows[i][field] !== nextValue && (operation !== 'fill' || !rows[i][field].trim()));
  const bulkSteps = ['Choose assets', 'Choose a column', 'Enter the change', 'Preview changes'];
  const title = tool.kind === 'row' ? (remove ? 'Remove row' : 'Edit asset row') : { add: 'Add column', columns: 'Manage columns', bulk: 'Bulk edit' }[tool.kind];
  function addColumn(k: Column) {
    const next = [...visible, k];
    if (k === 'usage' && !next.includes('unit')) next.push('unit');
    onColumns(next);
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
    <header className={styles.sheetToolHeader}><div><h2 ref={heading} tabIndex={-1} id="asset-sheet-tool-title">{title}</h2><p>{register}</p></div>
      <ShareModalCloseButton aria-label={'Close ' + title} onClick={onClose} /></header>
    <div className={styles.sheetToolBody}>
      {tool.kind === 'add' && <div className={styles.detailPickerChoices}>{columns.filter(k => !visible.includes(k)).map(k =>
        <button key={k} type="button" data-detail={k} aria-label={assetColumns[k]} onClick={() => addColumn(k)}>
          <DetailIcon kind={fieldPresentation[k].icon} /><span><strong>{assetColumns[k]}</strong><small>{fieldPresentation[k].hint}</small></span>
        </button>)}</div>}
      {tool.kind === 'columns' && <>
        <div className={styles.columnIntro}><p>Choose which columns to show.</p><span>Hidden values are kept.</span></div>
        <div className={styles.manageColumns}>{columns.slice(columnPage * 6, (columnPage + 1) * 6).map(k => {
          const count = rows.filter(r => r[k].trim()).length;
          return <div key={k} className={styles.manageColumnRow}><label>
            <input type="checkbox" aria-label={assetColumns[k]} checked={fields.includes(k)} disabled={k === 'title'} onChange={e => setFields(e.target.checked ? [...fields, k] : fields.filter(f => f !== k))} />
            <span><strong>{assetColumns[k]}</strong><small>{k === 'title' ? 'Always visible' : count + (count === 1 ? ' asset with a value' : ' assets with values')}</small></span>
          </label></div>;
        })}</div>
        <nav className={styles.bulkPager} aria-label="Column pages">
          <button disabled={columnPage === 0} onClick={() => setColumnPage(columnPage - 1)}>Previous columns</button>
          <span>{columnPage + 1} / {Math.ceil(columns.length / 6)}</span>
          <button disabled={(columnPage + 1) * 6 >= columns.length} onClick={() => setColumnPage(columnPage + 1)}>Next columns</button>
        </nav>
      </>}
      {tool.kind === 'row' && row && (remove ? <p>Remove {assetTitle(row) || 'row ' + (tool.index + 1)} from this draft sheet?</p> :
        <div className={styles.sheetToolFields}>{visible.map(k => <label key={k}>{assetColumns[k]}
          <input value={row[k]} onChange={e => setRow({ ...row, [k]: e.target.value })} /></label>)}</div>)}
      {tool.kind === 'bulk' && <>
        <h3>{bulkSteps[step]}</h3>
        {step === 0 && <PartsChoice label="Apply to" value={scope} onChange={setScope} options={[
          { value: 'all', label: 'All populated rows' }, ...(selected.length ? [{ value: 'selected', label: 'Selected rows (' + selected.length + ')' }] : []),
        ]} />}
        {step === 1 && <Select label="Asset field" usePortal={false} value={field} options={columns.map(k => ({ value: k, label: assetColumns[k] }))} onChange={setField} />}
        {step === 2 && <>
          <PartsChoice label={assetColumns[field]} value={operation} onChange={setOperation} options={[
            { value: 'replace', label: 'Replace values' }, { value: 'fill', label: 'Fill empty cells' }, { value: 'clear', label: 'Clear values' },
          ]} />
          {operation !== 'clear' && <label>New value<input value={value} onChange={e => setValue(e.target.value)} /></label>}
        </>}
        {step === 3 && <><p>{changed.length} {changed.length === 1 ? 'row' : 'rows'} will change in the {assetColumns[field]} column.</p>
          <div className={styles.tableWrap}><table><thead><tr><th>Row</th><th>Current value</th><th>New value</th></tr></thead>
            <tbody>{changed.map(i => <tr key={i}><th>{i + 1}</th><td>{rows[i][field] || 'Empty'}</td><td>{nextValue || 'Empty'}</td></tr>)}</tbody></table></div></>}
      </>}
    </div>
    <footer className={styles.sheetToolFooter}>
      <button onClick={onClose}>Cancel</button>
      {tool.kind === 'columns' && <button className={styles.primary} onClick={() => { onColumns(fields); onClose(); }}>Done</button>}
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
