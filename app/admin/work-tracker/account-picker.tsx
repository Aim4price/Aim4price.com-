"use client";

import { createPortal } from "react-dom";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import styles from "./account-picker.module.css";

export type AdminAccountPickerOption = {
  value: string;
  label: string;
  description: string;
  searchText?: string;
};

type AccountPickerProps = {
  label: string;
  value: string;
  options: AdminAccountPickerOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyOption?: Omit<AdminAccountPickerOption, "value">;
  recentValues?: string[];
  disabled?: boolean;
};

type VisibleOption = {
  option: AdminAccountPickerOption;
  group: "recent" | "all" | null;
};

function optionMatches(option: AdminAccountPickerOption, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-ZA");
  if (!normalizedQuery) return true;
  const haystack = `${option.label} ${option.description} ${option.searchText ?? ""}`
    .toLocaleLowerCase("en-ZA");
  return haystack.includes(normalizedQuery);
}

export default function AccountPicker({
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = "Search by name, email or account type",
  emptyOption,
  recentValues = [],
  disabled = false,
}: AccountPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const focusedOpenRef = useRef(false);
  const labelId = useId();
  const valueId = useId();
  const listboxId = useId();

  const emptyAccountOption = useMemo<AdminAccountPickerOption | null>(
    () => (emptyOption ? { value: "", ...emptyOption } : null),
    [emptyOption],
  );
  const selected =
    options.find((option) => option.value === value) ??
    (value === "" ? emptyAccountOption : null);

  const visibleOptions = useMemo<VisibleOption[]>(() => {
    const allOptions = emptyAccountOption ? [emptyAccountOption, ...options] : options;
    if (query.trim()) {
      return allOptions
        .filter((option) => optionMatches(option, query))
        .map((option) => ({ option, group: null }));
    }

    const optionByValue = new Map(options.map((option) => [option.value, option]));
    const recent = recentValues
      .map((recentValue) => optionByValue.get(recentValue))
      .filter((option): option is AdminAccountPickerOption => Boolean(option));
    const recentSet = new Set(recent.map((option) => option.value));
    const remaining = options.filter((option) => !recentSet.has(option.value));

    return [
      ...(emptyAccountOption ? [{ option: emptyAccountOption, group: null }] : []),
      ...recent.map((option): VisibleOption => ({ option, group: "recent" })),
      ...remaining.map((option): VisibleOption => ({
        option,
        group: recent.length ? "all" : null,
      })),
    ];
  }, [emptyAccountOption, options, query, recentValues]);
  const safeActiveIndex = visibleOptions.length
    ? Math.min(activeIndex, visibleOptions.length - 1)
    : 0;

  function closePicker(restoreFocus = true) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) window.requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function openPicker() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function closeAndMoveFocus(backward: boolean) {
    const trigger = buttonRef.current;
    if (!trigger) {
      closePicker();
      return;
    }
    const focusable = Array.from(document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => {
      if (menuRef.current?.contains(element)) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;
      return element === trigger || element.getClientRects().length > 0;
    });
    const triggerIndex = focusable.indexOf(trigger);
    const next = focusable[triggerIndex + (backward ? -1 : 1)] ?? trigger;
    closePicker(false);
    window.requestAnimationFrame(() => next.focus());
  }

  function chooseOption(option: AdminAccountPickerOption) {
    onChange(option.value);
    closePicker();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openPicker();
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
      return;
    }
    if (!visibleOptions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + visibleOptions.length) % visibleOptions.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(visibleOptions.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseOption(visibleOptions[safeActiveIndex]?.option ?? visibleOptions[0].option);
    } else if (event.key === "Tab") {
      event.preventDefault();
      closeAndMoveFocus(event.shiftKey);
    }
  }

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
      const width = Math.min(Math.max(rect.width, 340), viewportWidth - edge * 2);
      const estimatedHeight = 360;
      const below = viewportTop + viewportHeight - rect.bottom - edge - gap;
      const above = rect.top - viewportTop - edge - gap;
      const openAbove = below < 210 && above > below;
      const available = Math.max(56, openAbove ? above : below);
      const maxHeight = Math.min(estimatedHeight, available);
      const left = Math.min(
        Math.max(rect.left, viewportLeft + edge),
        viewportLeft + viewportWidth - width - edge,
      );
      const top = openAbove
        ? Math.max(viewportTop + edge, rect.top - gap - maxHeight)
        : rect.bottom + gap;
      setMenuStyle({ top, left, width, maxHeight });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closePicker(false);
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }

    let repositionFrame = 0;
    function queuePositionMenu(event?: Event) {
      const target = event?.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      window.cancelAnimationFrame(repositionFrame);
      repositionFrame = window.requestAnimationFrame(positionMenu);
    }

    positionMenu();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", queuePositionMenu);
    window.addEventListener("scroll", queuePositionMenu, true);
    window.visualViewport?.addEventListener("resize", queuePositionMenu);
    window.visualViewport?.addEventListener("scroll", queuePositionMenu);
    return () => {
      window.cancelAnimationFrame(repositionFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", queuePositionMenu);
      window.removeEventListener("scroll", queuePositionMenu, true);
      window.visualViewport?.removeEventListener("resize", queuePositionMenu);
      window.visualViewport?.removeEventListener("scroll", queuePositionMenu);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      focusedOpenRef.current = false;
      return;
    }
    if (!menuStyle || focusedOpenRef.current) return;
    focusedOpenRef.current = true;
    inputRef.current?.focus({ preventScroll: true });
  }, [menuStyle, open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = visibleOptions.findIndex(({ option }) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, value]);

  useEffect(() => {
    if (disabled && open) closePicker(false);
  }, [disabled, open]);

  useEffect(() => {
    if (!open || !visibleOptions.length) return;
    document
      .getElementById(`${listboxId}-option-${safeActiveIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [listboxId, open, safeActiveIndex, visibleOptions.length]);

  const menu = (
    <div ref={menuRef} className={styles.menu} style={menuStyle ?? undefined} data-dropdown-overlay-portal="true">
      <div className={styles.searchRow}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder={searchPlaceholder}
          role="combobox"
          aria-label={`${label} search`}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={visibleOptions.length ? `${listboxId}-option-${safeActiveIndex}` : undefined}
        />
      </div>
      <div id={listboxId} className={styles.options} role="listbox" aria-labelledby={labelId} data-dropdown-overlay-contained="true">
        {visibleOptions.length ? visibleOptions.map(({ option, group }, index) => {
          const previousGroup = visibleOptions[index - 1]?.group;
          const showHeading = group && group !== previousGroup;
          const isSelected = option.value === value;
          const isActive = index === safeActiveIndex;
          return (
            <Fragment key={option.value || "all-accounts"}>
              {showHeading ? (
                <div className={styles.groupLabel} role="presentation">
                  {group === "recent" ? "Recent accounts" : "All accounts"}
                </div>
              ) : null}
              <button
                id={`${listboxId}-option-${index}`}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ""} ${isActive ? styles.optionActive : ""}`}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => chooseOption(option)}
              >
                <span className={styles.optionCopy}>
                  <strong>
                    {option.label}
                    {option.description ? ` · ${option.description}` : ""}
                  </strong>
                </span>
                <span className={styles.check} aria-hidden="true">{isSelected ? "✓" : ""}</span>
              </button>
            </Fragment>
          );
        }) : (
          <div className={styles.noResults}>
            <strong>No accounts found</strong>
          </div>
        )}
      </div>
      <div className={styles.resultStatus} role="status" aria-live="polite">
        {visibleOptions.length
          ? `${visibleOptions.length} ${visibleOptions.length === 1 ? "account" : "accounts"} found`
          : "No accounts found"}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={styles.root}>
      <span id={labelId} className={styles.label}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        disabled={disabled}
        onClick={() => (open ? closePicker(false) : openPicker())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
      >
        <span id={valueId} className={styles.triggerCopy}>
          <strong>
            {selected
              ? `${selected.label}${selected.description ? ` · ${selected.description}` : ""}`
              : placeholder}
          </strong>
        </span>
        <svg viewBox="0 0 24 24" className={styles.chevron} aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open && menuStyle && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
