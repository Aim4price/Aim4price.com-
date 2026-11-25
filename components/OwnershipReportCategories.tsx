'use client';

import { useId, type Ref } from 'react';
import { costCategories } from '../lib/cost-categories';
import RecurringFieldIcon from '../app/my-invoices/RecurringFieldIcon';
import styles from '../app/my-invoices/cost-categories.module.css';

type Props = {
  selected: string[];
  onChange: (categories: string[]) => void;
  question?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  emptyMeansAll?: boolean;
  fuelSlips?: {
    included: boolean;
    onChange: (included: boolean) => void;
    disabled?: boolean;
    hint?: string;
  };
};

export default function OwnershipReportCategories({
  selected, onChange, fuelSlips, headingRef, emptyMeansAll = false,
  question = 'Which costs should this report include?',
}: Props) {
  const headingId = useId();
  const all = emptyMeansAll ? selected.length === 0 : selected.includes('all');

  function chooseAll() {
    if (emptyMeansAll || (all && fuelSlips)) onChange([]);
    else onChange(['all']);
  }

  function toggle(value: string) {
    const next = all ? [value] : selected.includes(value)
      ? selected.filter(category => category !== value)
      : [...selected, value];
    onChange(!emptyMeansAll && next.length === costCategories.length ? ['all'] : next);
  }

  return <section aria-labelledby={headingId} className={styles.reportCategories}>
    <div className={styles.reportToolbar}>
      <h3 id={headingId} ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{question}</h3>
      <div className={styles.reportToggles}>
        <button type="button" aria-pressed={all} onClick={chooseAll}>
          {all && <span aria-hidden="true">✓ </span>}All costs
        </button>
        {fuelSlips && <button type="button" aria-pressed={fuelSlips.included}
          disabled={fuelSlips.disabled} title={fuelSlips.hint}
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
