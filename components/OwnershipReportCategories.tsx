'use client';

import { costCategories } from '../lib/cost-categories';
import RecurringFieldIcon from '../app/my-invoices/RecurringFieldIcon';
import styles from '../app/my-invoices/cost-categories.module.css';

export default function OwnershipReportCategories({ selected, onChange, fuelSlips }: {
  selected: string[];
  fuelSlips?: { included: boolean; onChange: (included: boolean) => void };
  onChange: (categories: string[]) => void;
}) {
  const all = selected.includes('all');

  function toggle(value: string) {
    const next = all ? [value] : selected.includes(value)
      ? selected.filter(category => category !== value)
      : [...selected, value];
    onChange(next.length === costCategories.length ? ['all'] : next);
  }

  return <section aria-label="Cost categories" className={styles.reportCategories}>
    <div className={styles.reportToolbar}>
      <strong>Which costs should this report include?</strong>
      <div className={styles.reportToggles}>
        <button type="button" aria-pressed={all} onClick={() => onChange(all && fuelSlips ? [] : ['all'])}>
          {all && <span aria-hidden="true">✓ </span>}All costs
        </button>
        {fuelSlips && <button type="button" aria-pressed={fuelSlips.included}
          onClick={() => fuelSlips.onChange(!fuelSlips.included)}>
          {fuelSlips.included && <span aria-hidden="true">✓ </span>}Fuel slips
        </button>}
      </div>
    </div>
    <div className={styles.cards}>
      {costCategories.map(category => {
        const chosen = selected.includes(category.value);
        return <button type="button" key={category.value} className={styles.card}
          data-category={category.value} aria-pressed={chosen} onClick={() => toggle(category.value)}>
          <span className={chosen ? styles.selectionCheck : styles.icon} aria-hidden="true">
            {chosen ? '✓' : <RecurringFieldIcon kind={category.icon} />}
          </span>
          <span className={styles.copy}>
            <strong>{'shortLabel' in category ? category.shortLabel : category.label}</strong>
            <small>{category.subtitle}</small>
          </span>
        </button>;
      })}
    </div>
  </section>;
}
