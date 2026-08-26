'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import styles from './friendly-select.module.css';

export type FriendlySelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type FriendlySelectProps<T extends string> = {
  label: string;
  value: T;
  options: Array<FriendlySelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

export default function FriendlySelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: FriendlySelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    function positionMenu() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const edge = 12;
      const gap = 8;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
      const width = Math.min(Math.max(rect.width, 260), viewportWidth - edge * 2);
      const estimatedHeight = Math.min(320, Math.max(110, options.length * 72 + 12));
      const below = viewportTop + viewportHeight - rect.bottom - edge - gap;
      const above = rect.top - viewportTop - edge - gap;
      const openAbove = below < Math.min(estimatedHeight, 190) && above > below;
      const maxHeight = Math.max(110, Math.min(320, openAbove ? above : below));
      const left = Math.min(
        Math.max(rect.left, viewportLeft + edge),
        viewportLeft + viewportWidth - width - edge,
      );
      const top = openAbove
        ? Math.max(viewportTop + edge, rect.top - gap - Math.min(estimatedHeight, maxHeight))
        : rect.bottom + gap;

      setMenuStyle({ top, left, width, maxHeight });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    positionMenu();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    window.visualViewport?.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('scroll', positionMenu);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
      window.visualViewport?.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('scroll', positionMenu);
    };
  }, [open, options.length]);

  const menu = (
    <div
      ref={menuRef}
      id={menuId}
      className={styles.menu}
      data-dropdown-overlay-portal="true"
      role="listbox"
      aria-labelledby={labelId}
      style={menuStyle ?? undefined}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={active}
            className={`${styles.option} ${active ? styles.optionActive : ''}`}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
              buttonRef.current?.focus();
            }}
          >
            <span className={styles.optionCopy}>
              <strong>{option.label}</strong>
              {option.description ? <small>{option.description}</small> : null}
            </span>
            <span className={styles.check} aria-hidden="true">{active ? '✓' : ''}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={rootRef} className={`${styles.root} ${className}`}>
      <span id={labelId} className={styles.label}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.button} ${open ? styles.buttonOpen : ''}`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <span className={styles.buttonCopy}>
          <strong>{selected?.label ?? 'Select an option'}</strong>
          {selected?.description ? <small>{selected.description}</small> : null}
        </span>
        <svg viewBox="0 0 24 24" className={styles.chevron} aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>

      {open && menuStyle && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
}

