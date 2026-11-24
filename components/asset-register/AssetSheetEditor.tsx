'use client';

import { useRef, useState, type ClipboardEvent } from 'react';
import { assetColumns, blankAsset, columns, maxAssets, rowErrors, type AssetRow, type Column, type Basis } from '../../lib/asset-sheet';
import parts from '../../app/dealer/parts/parts.module.css';
import { DetailIcon } from '../PartsDetailFields';
import Select from '../AssetModalSelect';
import AssetSheetTools, { type AssetTool } from './AssetSheetTools';
import css from './AssetSheetDialog.module.css';

export type AssetDraft = { rows: AssetRow[]; visible: Column[]; basis: Basis };
type Props = {
  draft: AssetDraft;
  register: string;
  validate: boolean;
  page: number;
  size: number;
  onPage: (page: number) => void;
  onChange: (next: Partial<AssetDraft>, remember?: boolean) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>, row: number, key: Column) => void;
  onUndo: () => void;
  canUndo: boolean;
};

export default function AssetSheetEditor({ draft: { rows, visible, basis }, register, validate, page, size, onPage, onChange, onPaste, onUndo, canUndo }: Props) {
  const [tool, setTool] = useState<AssetTool | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const editing = useRef<HTMLInputElement | null>(null);
  const populated = rows.filter(r => columns.some(k => r[k].trim())).length;
  function removeRow(index: number) {
    onChange({ rows: rows.length === 1 ? [blankAsset()] : rows.filter((_, i) => i !== index) });
    setSelected(selected.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  }
  function changeColumns(fields: Column[]) {
    onChange({ visible: fields });
  }
  return <div className={parts.stockSheet}>
    <div className={`${parts.sheetToolbar} ${css.tools}`} role="group" aria-label="Sheet tools">
      <span>{selected.length ? selected.length + ' selected' : populated + (populated === 1 ? ' asset' : ' assets')}</span>
      <button disabled={visible.length === columns.length} onClick={() => setTool({ kind: 'add' })}><DetailIcon kind="addColumn" />Add column</button>
      <button onClick={() => setTool({ kind: 'columns' })}><DetailIcon kind="columns" />Manage columns</button>
      <button disabled={!populated && !selected.length} onClick={() => setTool({ kind: 'bulk' })}><DetailIcon kind="edit" />Bulk edit</button>
      <button disabled={!canUndo} onClick={() => { setSelected([]); onUndo(); }}><DetailIcon kind="undo" />Undo</button>
    </div>
    {(visible.includes('value') || rows.some(r => r.value.trim())) &&
      <Select label="Current values in rand" placeholder="Choose VAT basis" value={basis}
        options={[{ value: 'excluded', label: 'Current values exclude VAT' }, { value: 'included', label: 'Current values include VAT' }]}
        onChange={v => onChange({ basis: v as Basis })} />}
    <div className={css.gridScroll} role="region" aria-label="Assets spreadsheet" tabIndex={0}>
      <table className={`${parts.editorTable} ${css.assetGrid}`} style={{ minWidth: 132 + 240 + (visible.length - 1) * 160 }}>
        <colgroup><col className={css.rowColumn} />{visible.map(k => <col key={k} className={k === 'title' && visible.length > 1 ? css.titleColumn : undefined} />)}</colgroup>
        <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all rows" checked={selected.length === rows.length}
          ref={el => { if (el) el.indeterminate = selected.length > 0 && selected.length < rows.length; }}
          onChange={e => setSelected(e.target.checked ? rows.map((_, i) => i) : [])} /></th>
          {visible.map(k => <th key={k} scope="col">{assetColumns[k]}<small>{k === 'title' ? 'Or use make and model' : 'Optional'}</small></th>)}</tr></thead>
        <tbody>{rows.slice(page * size, (page + 1) * size).map((r, j) => {
          const index = page * size + j;
          const errors = validate && columns.some(k => r[k].trim()) ? rowErrors(r, basis) : {};
          return <tr key={index} data-selected={selected.includes(index) || undefined}>
            <td><div className={parts.sheetRowControls}>
              <input type="checkbox" aria-label={'Select row ' + (index + 1)} checked={selected.includes(index)} onChange={e => setSelected(e.target.checked ? [...selected, index] : selected.filter(i => i !== index))} />
              <span className={parts.sheetRowNumber}>{index + 1}</span>
              <button type="button" className={parts.sheetRowAction} aria-haspopup="dialog" aria-label={'Actions for row ' + (index + 1)} onClick={() => setTool({ kind: 'row', index })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3 1-1h4l1 3 2 1 3-.5 2 3-2 2v3l2 2-2 3-3-.5-2 1-1 3h-4l-1-3-2-1-3 .5-2-3 2-2v-3l-2-2 2-3 3 .5 2-1Z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            </div></td>
            {visible.map(k => <td key={k}>
              <input aria-label={assetColumns[k] + ' row ' + (index + 1)} value={r[k]} placeholder={k === 'unit' ? 'hours, km or %' : undefined}
                aria-invalid={!!errors[k]} aria-describedby={errors[k] ? 'asset-error-' + index + '-' + k : undefined}
                onBlur={() => { editing.current = null; }} onPaste={e => { editing.current = null; onPaste(e, index, k); }}
                onChange={e => {
                  const value = e.target.value;
                  onChange({ rows: rows.map((row, i) => i === index ? { ...row, [k]: value } : row) }, editing.current !== e.currentTarget);
                  editing.current = e.currentTarget;
                }} />
              {errors[k] && <small id={'asset-error-' + index + '-' + k} className={parts.cellError}>{errors[k]}</small>}
            </td>)}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className={`${parts.actions} ${css.rowActions}`}><button disabled={rows.length >= maxAssets} onClick={() => { onChange({ rows: [...rows, blankAsset()] }); onPage(Math.floor(rows.length / size)); }}>+ Add row</button><span>{rows.length} {rows.length === 1 ? 'row' : 'rows'}</span></div>
    {tool && <AssetSheetTools tool={tool} rows={rows} selected={selected} visible={visible} register={register}
      onColumns={changeColumns} onRows={(next, field) => onChange({ rows: next, visible: field && !visible.includes(field) ? [...visible, field] : visible })}
      onRemove={removeRow} onClose={() => setTool(null)} />}
  </div>;
}
