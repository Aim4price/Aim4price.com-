'use client';

import { assetColumns, basisForColumn, type Basis, type MoneyColumn, type SheetBasis } from '../../lib/asset-sheet';
import css from './AssetSheetDialog.module.css';

function VatChoices({ label, field, value, onChange }: {
  label: string; field: string; value: Basis; onChange: (value: Basis) => void;
}) {
  return <div className={css.vatChoices} role="group" aria-label={label} data-vat-field={field}>
    {(['excluded', 'included'] as const).map(option =>
      <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
        {option === 'included' ? 'Incl. VAT' : 'Excl. VAT'}
      </button>)}
  </div>;
}

export default function AssetSheetVat({ fields, basis, onChange }: {
  fields: MoneyColumn[]; basis: SheetBasis; onChange: (basis: SheetBasis) => void;
}) {
  if (!fields.length) return null;
  const perColumn = typeof basis !== 'string';
  function useOneSetting() {
    const first = basisForColumn(basis, fields[0]);
    onChange(fields.every(k => basisForColumn(basis, k) === first) ? first : '');
  }
  return <section className={css.vatPanel} aria-label="VAT on sheet values">
    <div className={css.vatHeading}>
      <strong>How are the amounts in your sheet shown?</strong>
      {typeof basis === 'string' && <VatChoices label="VAT for all amounts" field="all" value={basis} onChange={onChange} />}
      {perColumn ? <button className={css.vatMode} type="button" onClick={useOneSetting}>Use one VAT setting</button>
        : fields.length > 1 && <button className={css.vatMode} type="button"
          onClick={() => onChange({ value: basis, replacement: basis, insuredValue: basis })}>Set VAT per column</button>}
    </div>
    {typeof basis !== 'string' && <div className={css.vatColumns}>{fields.map(field =>
      <div key={field}><span>{assetColumns[field]}</span>
        <VatChoices label={assetColumns[field] + ' VAT'} field={field} value={basis[field]}
          onChange={value => onChange({ ...basis, [field]: value })} />
      </div>)}</div>}
  </section>;
}
