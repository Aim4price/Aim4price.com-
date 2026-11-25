'use client';

import { useLayoutEffect, useRef, useState, type ClipboardEvent } from 'react';
import { assetColumns, blankAsset, columns, maxAssets, rowErrors, type AssetRow, type Column, type Basis } from '../../lib/asset-sheet';
import parts from '../../app/dealer/parts/parts.module.css';
import { DetailIcon } from '../PartsDetailFields';
import Select from '../AssetModalSelect';
import AssetSheetTools, { type AssetTool } from './AssetSheetTools';
import SheetColumnHeader, { useSheetColumns } from '../SheetColumnHeader';
import css from './AssetSheetDialog.module.css';

export type AssetDraft = { rows: AssetRow[]; visible: Column[]; basis: Basis };
const initialWidths: Record<Column, number> = {
  title: 340, make: 172, model: 180, category: 180, year: 112,
  serial: 210, usage: 136, unit: 142, value: 172,
};
const rowControlWidth = 132;

type Props = {
  registerId: string;
  draft: AssetDraft;
  register: string;
  validate: boolean;
  page: number;
  size: number;
  onPage: (page: number) => void;
  onChange: (next: Partial<AssetDraft>, remember?: boolean) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>, row: number, key: Column, ordered: Column[]) => void;
  onUndo: () => void;
  canUndo: boolean;
};

export default function AssetSheetEditor({ draft: { rows, visible: fields, basis }, registerId, register, validate, page, size, onPage, onChange, onPaste, onUndo, canUndo }: Props) {
  const layout = useSheetColumns('aim4price:asset-sheet:' + registerId);
  const visible = layout.ordered(fields);
  const widthOf = (key: Column) => layout.widths[key] ?? initialWidths[key];
  const tableWidth = visible.reduce((total, key) => total + widthOf(key), rowControlWidth);
  const grid = useRef<HTMLDivElement>(null);
  const focusRow = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focusRow.current === null) return;
    const input = grid.current?.querySelector<HTMLInputElement>(`[data-row="${focusRow.current}"] td:nth-child(2) input`);
    if (input) { input.focus(); focusRow.current = null; }
  }, [rows.length, page]);

  function addRow() {
    focusRow.current = rows.length;
    onChange({ rows: [...rows, blankAsset()] });
    onPage(Math.floor(rows.length / size));
  }
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
      <button disabled={rows.length >= maxAssets} onClick={addRow}>+ Add row</button>
      <button disabled={visible.length === columns.length} onClick={() => setTool({ kind: 'add' })}><DetailIcon kind="addColumn" />Add column</button>
      <button onClick={() => setTool({ kind: 'columns' })}><DetailIcon kind="columns" />Manage columns</button>
      <button disabled={!populated && !selected.length} onClick={() => setTool({ kind: 'bulk' })}><DetailIcon kind="edit" />Bulk edit</button>
      <button disabled={!canUndo} onClick={() => { setSelected([]); onUndo(); }}><DetailIcon kind="undo" />Undo</button>
    </div>
    {(visible.includes('value') || rows.some(r => r.value.trim())) &&
      <Select label="Current values in rand" buttonLabel="Current values in rand" placeholder="Choose VAT basis" value={basis}
        options={[{ value: 'excluded', label: 'Current values exclude VAT' }, { value: 'included', label: 'Current values include VAT' }]}
        onChange={v => onChange({ basis: v as Basis })} />}
    <div ref={grid} data-sheet-scroll className={css.gridScroll} role="region" aria-label="Assets spreadsheet" tabIndex={0}>
      <table className={`${parts.editorTable} ${css.assetGrid}`} style={{ width: tableWidth }}>
        <colgroup><col style={{ width: rowControlWidth }} />{visible.map(k => <col key={k} style={{ width: widthOf(k) }} />)}</colgroup>
        <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all rows" checked={selected.length === rows.length}
          ref={el => { if (el) el.indeterminate = selected.length > 0 && selected.length < rows.length; }}
          onChange={e => setSelected(e.target.checked ? rows.map((_, i) => i) : [])} /></th>
          {visible.map((k, position) => <th key={k} scope="col">
            <SheetColumnHeader label={assetColumns[k]} hint={k === 'title' ? 'Or use make and model' : 'Optional'}
              index={position} count={visible.length} width={widthOf(k)} getValues={() => rows.map(row => row[k])}
              onMove={direction => layout.move(columns, visible, k, direction)}
              onResize={(width, persist) => layout.resize(k, width, persist)} />
          </th>)}</tr></thead>
        <tbody>{rows.slice(page * size, (page + 1) * size).map((r, j) => {
          const index = page * size + j;
          const errors = validate && columns.some(k => r[k].trim()) ? rowErrors(r, basis) : {};
          return <tr key={index} data-row={index} data-selected={selected.includes(index) || undefined}>
            <td><div className={parts.sheetRowControls}>
              <input type="checkbox" aria-label={'Select row ' + (index + 1)} checked={selected.includes(index)} onChange={e => setSelected(e.target.checked ? [...selected, index] : selected.filter(i => i !== index))} />
              <span className={parts.sheetRowNumber}>{index + 1}</span>
              <button type="button" className={parts.sheetRowAction} aria-haspopup="dialog" aria-label={'Actions for row ' + (index + 1)} onClick={() => setTool({ kind: 'row', index })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3 1-1h4l1 3 2 1 3-.5 2 3-2 2v3l2 2-2 3-3-.5-2 1-1 3h-4l-1-3-2-1-3 .5-2-3 2-2v-3l-2-2 2-3 3 .5 2-1Z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            </div></td>
            {visible.map(k => <td key={k}>
              <input data-field={k} title={r[k] || undefined} aria-label={assetColumns[k] + ' row ' + (index + 1)} value={r[k]} placeholder={k === 'unit' ? 'hours, km or %' : undefined}
                aria-invalid={!!errors[k]} aria-describedby={errors[k] ? 'asset-error-' + index + '-' + k : undefined}
                onBlur={() => { editing.current = null; }} onPaste={e => { editing.current = null; onPaste(e, index, k, visible); }}
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
    {tool && <AssetSheetTools tool={tool} rows={rows} selected={selected} visible={visible} register={register}
      onColumns={changeColumns} onRows={(next, field) => onChange({ rows: next, visible: field && !visible.includes(field) ? [...visible, field] : visible })}
      onRemove={removeRow} onClose={() => setTool(null)} />}
  </div>;
}
