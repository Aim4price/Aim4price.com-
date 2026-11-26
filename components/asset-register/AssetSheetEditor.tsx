'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ClipboardEvent } from 'react';
import { columnLabel, isCustomColumn, hasAssetData, blankAsset, columns, populatedMoneyColumns, sheetChoices, maxAssets, type BuiltInColumn, type CustomColumn, rowErrors, type AssetRow, type Column, type SheetBasis } from '../../lib/asset-sheet';
import parts from '../../app/dealer/parts/parts.module.css';
import AssetSheetVat from './AssetSheetVat';
import AssetSheetTools, { type AssetTool } from './AssetSheetTools';
import SheetColumnHeader, { useSheetColumns } from '../SheetColumnHeader';
import css from './AssetSheetDialog.module.css';

export type AssetDraft = { rows: AssetRow[]; visible: Column[]; custom: CustomColumn[]; basis: SheetBasis };
const initialWidths: Record<BuiltInColumn, number> = {
  title: 234, make: 172, model: 180, category: 180, year: 112,
  serial: 210, condition: 170, usage: 136, unit: 142, value: 172, replacement: 200,
  registration: 200, license: 160, finance: 160, financeNote: 240,
  insurance: 170, insuredValue: 170, insuranceNote: 240, note: 260,
};
const rowControlWidth = 122;

type Props = {
  registerId: string;
  savedColumns: CustomColumn[];
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

export default function AssetSheetEditor({ draft: { rows, visible: fields, basis, custom }, savedColumns, registerId, register, validate, page, size, onPage, onChange, onPaste, onUndo, canUndo }: Props) {
  const layout = useSheetColumns('aim4price:asset-sheet:' + registerId);
  const visible = layout.ordered(fields);
  const allColumns = [...columns, ...custom];
  const widthOf = (key: Column) => layout.widths[key] ?? (isCustomColumn(key) ? 200 : initialWidths[key]);
  const tableWidth = visible.reduce((total, key) => total + widthOf(key), rowControlWidth);
  const grid = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => setGridWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const titleWidth = widthOf('title');
  // A very wide fitted name or a narrow screen must still leave room to edit other cells.
  const pinName = visible[0] === 'title' && gridWidth - rowControlWidth - titleWidth >= 210;
  const focusRow = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focusRow.current === null) return;
    const input = grid.current?.querySelector<HTMLInputElement>(`[data-row="${focusRow.current}"] input[data-field="title"]`);
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
  const populated = rows.filter(hasAssetData).length;
  const amountFields = populatedMoneyColumns(rows);
  function removeRow(index: number) {
    onChange({ rows: rows.length === 1 ? [blankAsset()] : rows.filter((_, i) => i !== index) });
    setSelected(selected.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  }
  return <div className={parts.stockSheet}>
    <div className={`${parts.sheetToolbar} ${css.tools}`} role="group" aria-label="Sheet tools">
      <span role="status">{selected.length ? selected.length + ' selected' : populated
        ? populated + (populated === 1 ? ' asset' : ' assets') : 'Type an asset or paste rows from Excel.'}</span>
      <button type="button" disabled={rows.length >= maxAssets} onClick={addRow}>+ Add row</button>
      <button type="button" aria-haspopup="dialog" onClick={() => setTool({ kind: 'columns' })}>Columns</button>
      {populated > 0 && <button type="button" aria-haspopup="dialog" onClick={() => setTool({ kind: 'bulk' })}>Bulk edit</button>}
      <button type="button" disabled={!canUndo} onClick={() => { setSelected([]); onUndo(); }}>Undo</button>
    </div>
    <AssetSheetVat fields={amountFields} basis={basis} onChange={next => onChange({ basis: next })} />
    {Object.entries(sheetChoices).map(([key, choices]) => <datalist key={key} id={'asset-sheet-options-' + key}>
      {choices.map(label => <option key={label} value={label} />)}
    </datalist>)}
    <div ref={grid} data-sheet-scroll data-pin-name={pinName || undefined}
      style={{ '--row-width': rowControlWidth + 'px', '--pin-name-width': (pinName ? titleWidth : 0) + 'px' } as CSSProperties} className={css.gridScroll} role="region" aria-label="Assets spreadsheet" tabIndex={0}>
      <table className={`${parts.editorTable} ${css.assetGrid}`} style={{ width: tableWidth }}>
        <colgroup><col style={{ width: rowControlWidth }} />{visible.map(k => <col key={k} style={{ width: widthOf(k) }} />)}</colgroup>
        <thead><tr><th scope="col">
          <label className={css.rowSelect}>
            <input type="checkbox" aria-label="Select all rows" checked={rows.length > 0 && selected.length === rows.length}
              ref={el => { if (el) el.indeterminate = selected.length > 0 && selected.length < rows.length; }}
              onChange={e => setSelected(e.target.checked ? rows.map((_, i) => i) : [])} />
            Select all
          </label>
        </th>
          {visible.map(k => <th key={k} data-name-column={k === 'title' || undefined} scope="col">
            <SheetColumnHeader label={columnLabel(k)} hint={k === 'title' ? 'Or use brand and model' : undefined}
              width={widthOf(k)} getValues={() => rows.map(row => row[k] ?? '')}
              onResize={(width, persist) => layout.resize(k, width, persist)} />
          </th>)}</tr></thead>
        <tbody>{rows.slice(page * size, (page + 1) * size).map((r, j) => {
          const index = page * size + j;
          const errors = validate && hasAssetData(r) ? rowErrors(r, basis) : {};
          return <tr key={index} data-row={index} data-selected={selected.includes(index) || undefined}>
            <td><div className={css.rowControls}>
              <label className={css.rowSelect}>
                <input type="checkbox" aria-label={'Select row ' + (index + 1)} checked={selected.includes(index)} onChange={e => setSelected(e.target.checked ? [...selected, index] : selected.filter(i => i !== index))} />
                {index + 1}
              </label>
              <button type="button" className={css.editRow} aria-haspopup="dialog" aria-label={'Edit row ' + (index + 1)}
                onClick={() => setTool({ kind: 'row', index })}>Edit</button>
            </div></td>
            {visible.map(k => <td key={k} data-name-column={k === 'title' || undefined}>
              <input data-field={k} list={!isCustomColumn(k) && sheetChoices[k] ? 'asset-sheet-options-' + k : undefined} title={r[k] || undefined} aria-label={columnLabel(k) + ' row ' + (index + 1)} value={r[k] ?? ''} placeholder={k === 'unit' ? 'hours, km or %' : undefined}
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
      custom={custom} savedColumns={savedColumns} onChange={onChange} onRows={(next, field) => onChange({ rows: next, visible: field && !visible.includes(field) ? [...visible, field] : visible })}
      onMove={(key, direction) => layout.move([...visible, ...allColumns.filter(k => !visible.includes(k))], visible, key, direction)} onRemove={removeRow} onClose={() => setTool(null)} />}
  </div>;
}
