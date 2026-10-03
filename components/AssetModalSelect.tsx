'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {websiteLogicalRect,websiteVisibleViewport} from '../lib/website-canvas';
import {isViewportScrollbarInteraction} from '../lib/viewport-scrollbar';
import styles from '../app/asset-register/page.module.css';
function ChevronDownIcon({className}:{className?:string}) {return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m6 9 6 6 6-6-1.4-1.4L12 12.2 7.4 7.6Z"/></svg>}
export type ModalSelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ModalSelectPortalStyle = CSSProperties & {
  '--asset-select-top': string;
  '--asset-select-left': string;
  '--asset-select-width': string;
  '--asset-select-max-height': string;
};

type ModalSelectProps<T extends string> = {
  label: string;
  value: T | '';
  options: Array<ModalSelectOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  autoFocus?: boolean;
  showDescriptions?: boolean;
  usePortal?: boolean;
  assetDetailEditTarget?: string;
  buttonLabel?: string;
};

export default function ModalSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option',
  className = '',
  menuClassName = '',
  autoFocus = false,
  showDescriptions = true,
  usePortal = true,
  assetDetailEditTarget,
  buttonLabel,
}: ModalSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalMenuStyle, setPortalMenuStyle] = useState<ModalSelectPortalStyle | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (isViewportScrollbarInteraction(event)) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !usePortal) {
      setPortalMenuStyle(null);
      return undefined;
    }

    function updatePortalPosition() {
      const button = buttonRef.current;
      if (!button) {
        return;
      }

      const rect = websiteLogicalRect(button.getBoundingClientRect());
      const viewportWidth = websiteVisibleViewport().width;
      const viewportHeight = websiteVisibleViewport().height;
      const viewportLeft = websiteVisibleViewport().left;
      const viewportTop = websiteVisibleViewport().top;
      const gap = 8;
      const edgeGap = 12;
      const availableWidth = Math.max(160, viewportWidth - edgeGap * 2);
      const menuWidth = Math.min(Math.max(220, rect.width), availableWidth);
      const left = Math.min(Math.max(rect.left, viewportLeft + edgeGap), viewportLeft + viewportWidth - menuWidth - edgeGap);
      const spaceBelow = viewportTop + viewportHeight - rect.bottom - gap - edgeGap;
      const spaceAbove = rect.top - viewportTop - gap - edgeGap;
      const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(144, openAbove ? spaceAbove : spaceBelow);
      const maxHeight = Math.min(288, availableHeight);
      const top = openAbove ? Math.max(viewportTop + edgeGap, rect.top - gap - maxHeight) : Math.min(viewportTop + viewportHeight - edgeGap, rect.bottom + gap);

      setPortalMenuStyle({
        '--asset-select-top': `${Math.round(top)}px`,
        '--asset-select-left': `${Math.round(left)}px`,
        '--asset-select-width': `${Math.round(menuWidth)}px`,
        '--asset-select-max-height': `${Math.round(maxHeight)}px`,
      });
    }

    updatePortalPosition();
    window.addEventListener('resize', updatePortalPosition);
    window.addEventListener('aim4price:canvas-geometry', updatePortalPosition);
    window.addEventListener('scroll', updatePortalPosition, true);
    window.visualViewport?.addEventListener('resize', updatePortalPosition);
    window.visualViewport?.addEventListener('scroll', updatePortalPosition);

    return () => {
      window.removeEventListener('resize', updatePortalPosition);
      window.removeEventListener('aim4price:canvas-geometry', updatePortalPosition);
      window.removeEventListener('scroll', updatePortalPosition, true);
      window.visualViewport?.removeEventListener('resize', updatePortalPosition);
      window.visualViewport?.removeEventListener('scroll', updatePortalPosition);
    };
  }, [isOpen, usePortal]);

  const menu = (
    <div
      ref={menuRef}
      className={`${styles.customSelectMenu} ${usePortal ? styles.customSelectMenuPortal : ''} ${!showDescriptions ? styles.customSelectMenuSingleLine : ''} ${menuClassName}`}
      style={usePortal ? portalMenuStyle ?? undefined : undefined}
      data-dropdown-overlay-portal="true"
      role="listbox"
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            type="button"
            role="option"
            aria-selected={isSelected}
            key={option.value || option.label}
            className={`${styles.customSelectOption} ${!showDescriptions ? styles.customSelectOptionSingleLine : ''} ${isSelected ? styles.customSelectOptionActive : ''}`}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
          >
            {showDescriptions ? (
              <span className={styles.customSelectOptionText}>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
            ) : (
              <span className={styles.customSelectOptionLabel}>{option.label}</span>
            )}
            {isSelected ? <b aria-hidden="true">&#10003;</b> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`${styles.field} ${styles.customSelectField} ${className}`}
      ref={wrapRef}
      data-asset-detail-edit-target={assetDetailEditTarget}
    >
      <span>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.customSelectButton} ${isOpen ? styles.customSelectButtonOpen : ''} ${!selectedOption ? styles.customSelectButtonPlaceholder : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-label={buttonLabel}
        aria-expanded={isOpen}
        autoFocus={autoFocus}
      >
        <span className={styles.customSelectButtonText}>
          <span className={styles.customSelectButtonCopy}>
            <span>{selectedOption?.label ?? placeholder}</span>
          </span>
        </span>
        <ChevronDownIcon className={styles.customSelectChevron} />
      </button>

      {isOpen && (!usePortal || portalMenuStyle)
        ? usePortal && typeof document !== 'undefined'
          ? createPortal(menu, document.body)
          : menu
        : null}
    </div>
  );
}
