'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import DropdownOverlay from '../../components/DropdownOverlay';
import styles from './page.module.css';

export type MarketplaceFilterOption<T extends string> = {
  value: T;
  label: string;
};

type MarketplaceFilterSelectProps<T extends string> = {
  value: T;
  options: readonly MarketplaceFilterOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
};

function clampOptionIndex(index: number, optionCount: number): number {
  if (optionCount <= 0) return 0;
  return Math.min(optionCount - 1, Math.max(0, index));
}

export default function MarketplaceFilterSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: MarketplaceFilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus();
    });

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeIndex, open]);

  function openMenu(nextIndex = selectedIndex) {
    if (disabled || options.length === 0) return;
    setActiveIndex(clampOptionIndex(nextIndex, options.length));
    setOpen(true);
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  }

  function moveFocus(nextIndex: number) {
    const normalizedIndex = clampOptionIndex(nextIndex, options.length);
    setActiveIndex(normalizedIndex);
    optionRefs.current[normalizedIndex]?.focus();
  }

  function chooseOption(option: MarketplaceFilterOption<T>) {
    onChange(option.value);
    closeMenu({ restoreFocus: true });
  }

  function handleButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu(open ? activeIndex + 1 : selectedIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(open ? activeIndex - 1 : selectedIndex);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      openMenu(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      openMenu(options.length - 1);
    }
  }

  function handleOptionKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    optionIndex: number,
  ) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(optionIndex === options.length - 1 ? 0 : optionIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(optionIndex === 0 ? options.length - 1 : optionIndex - 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveFocus(options.length - 1);
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={styles.filterSelect}
      data-marketplace-filter-select="true"
    >
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.filterSelectButton} ${open ? styles.filterSelectButtonOpen : ''}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleButtonKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <span className={styles.filterSelectValue}>{selectedOption?.label ?? 'Choose an option'}</span>
        <svg className={styles.filterSelectChevron} viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5.5 7.5 4.5 4.75 4.5-4.75" />
        </svg>
      </button>

      {open && !disabled ? (
        <DropdownOverlay
          anchorRef={buttonRef}
          id={menuId}
          className={styles.filterSelectMenu}
          role="listbox"
          aria-label={ariaLabel}
          maxHeight={320}
        >
          {options.map((option, optionIndex) => {
            const selected = option.value === value;

            return (
              <button
                ref={(node) => {
                  optionRefs.current[optionIndex] = node;
                }}
                key={option.value || 'all'}
                type="button"
                className={`${styles.filterSelectOption} ${selected ? styles.filterSelectOptionActive : ''}`}
                onClick={() => chooseOption(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
                role="option"
                aria-selected={selected}
              >
                <span className={styles.filterSelectOptionLabel}>{option.label}</span>
                <span className={styles.filterSelectCheck} aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="m4 8.2 2.5 2.5L12 5.5" />
                  </svg>
                </span>
              </button>
            );
          })}
        </DropdownOverlay>
      ) : null}
    </div>
  );
}
