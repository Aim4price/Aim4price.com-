"use client";
import { useId, type ReactNode } from "react";
import styles from "../app/dealer/parts/parts.module.css";

type Option = { value: string; label: string; hint?: string; disabled?: boolean; icon?: ReactNode };
/** Visible, keyboard-accessible choices without an operating-system dropdown. */
export default function PartsChoice({ label, value, options, onChange, hideLabel = false }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; hideLabel?: boolean;
}) {
  const name = useId();
  return <fieldset className={styles.partsChoice}>
    <legend className={hideLabel ? styles.choiceLabelHidden : undefined}>{label}</legend>
    <div className={styles.partsChoiceOptions}>
      {options.map(option => <label key={option.value} data-disabled={option.disabled || undefined}>
        <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} />
        {option.icon}
        <span><strong>{option.label}</strong>{option.hint && <small>{option.hint}</small>}</span>
      </label>)}
    </div>
  </fieldset>;
}
