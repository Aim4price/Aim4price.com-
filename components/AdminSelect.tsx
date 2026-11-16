"use client";

import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "./WebsitePortal";
import { websiteLogicalRect, websiteVisibleViewport } from "../lib/website-canvas";
import owner from "../app/account/friendly-select.module.css";
import styles from "./AdminSelect.module.css";

type Option = { value: string; label: string; disabled: boolean };
function optionText(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join("");
}
function readOptions(children: ReactNode, groupDisabled = false): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean; hidden?: boolean }>(child)) return [];
    if (child.type === Fragment || child.type === "optgroup") return readOptions(child.props.children, groupDisabled || Boolean(child.props.disabled));
    if (child.type !== "option" || child.props.hidden) return [];
    const label = optionText(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: groupDisabled || Boolean(child.props.disabled) }];
  });
}

/** Owner account styling with native form/change semantics and a keyboard-accessible popup. */
export default function AdminSelect({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const listbox = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const id = useId();
  const [label, setLabel] = useState(props["aria-label"] ?? "Choose an option");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>();
  const [uncontrolled, setUncontrolled] = useState(String(props.defaultValue ?? ""));
  const options = useMemo(() => readOptions(children), [children]);
  const value = String(props.value ?? (uncontrolled || options[0]?.value) ?? "");
  const selected = options.find(option => option.value === value);
  const visible = options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const searchable = options.length > 10;

  useEffect(() => {
    if (props["aria-label"]) { setLabel(props["aria-label"]); return; }
    const labels = Array.from(native.current?.labels ?? []).map(element => {
      const copy = element.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[data-admin-select]').forEach(node => node.remove());
      return copy.textContent?.trim() ?? "";
    }).filter(Boolean);
    if (labels.length) setLabel(labels.join(" "));
  }, [props["aria-label"], children]);

  function close(restore = true) {
    setOpen(false);
    setQuery("");
    if (restore) trigger.current?.focus({ preventScroll: true });
  }
  function choose(option: Option) {
    if (option.disabled || !native.current) return;
    native.current.value = option.value;
    setUncontrolled(option.value);
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }
  function show() {
    if (props.disabled) return;
    setQuery("");
    const index = options.findIndex(option => option.value === value && !option.disabled);
    setActive(index >= 0 ? index : Math.max(0, options.findIndex(option => !option.disabled)));
    setOpen(true);
  }
  function move(step: number) {
    for (let offset = 1; offset <= visible.length; offset++) {
      const next = (active + step * offset + visible.length) % visible.length;
      if (!visible[next].disabled) { setActive(next); break; }
    }
  }
  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
    else if (event.key === "Enter" || (event.key === " " && event.target !== search.current)) { event.preventDefault(); if (visible[active]) choose(visible[active]); }
    else if ((event.key === "Home" || event.key === "End") && event.target !== search.current) {
      event.preventDefault();
      const indexes = visible.flatMap((option, index) => option.disabled ? [] : [index]);
      setActive((event.key === "Home" ? indexes[0] : indexes.at(-1)) ?? 0);
    } else if (event.key === "Tab") {
      event.preventDefault();
      const focusable = Array.from(document.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'))
        .filter(element => element.getClientRects().length && !element.closest('[inert]') && !popup.current?.contains(element) && element.tabIndex >= 0);
      const next = focusable[focusable.indexOf(trigger.current!) + (event.shiftKey ? -1 : 1)];
      close(false);
      (next ?? trigger.current)?.focus();
    } else if (event.key.length === 1 && event.target !== search.current && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - typeahead.current.time < 650 ? typeahead.current.text : "") + event.key.toLocaleLowerCase();
      typeahead.current = { text, time: now };
      const index = visible.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(text));
      if (index >= 0) setActive(index);
    }
  }

  useEffect(() => {
    if (!open || props.disabled) { if (props.disabled) setOpen(false); return; }
    let frame = 0;
    function place() {
      if (!trigger.current) return;
      const rect = websiteLogicalRect(trigger.current.getBoundingClientRect());
      const viewport = websiteVisibleViewport();
      const width = Math.min(Math.max(rect.width, 280), viewport.width - 24);
      const below = viewport.top + viewport.height - rect.bottom - 20;
      const above = rect.top - viewport.top - 20;
      const aboveTrigger = below < 220 && above > below;
      const height = Math.min(400, options.length * 55 + (searchable ? 70 : 16), Math.max(64, aboveTrigger ? above : below));
      setPosition({ width, maxHeight: height, left: Math.max(viewport.left + 12, Math.min(rect.left, viewport.left + viewport.width - width - 12)), top: aboveTrigger ? Math.max(viewport.top + 12, rect.top - height - 8) : rect.bottom + 8 });
    }
    function queue(event?: Event) {
      if (event?.target instanceof Node && popup.current?.contains(event.target)) return;
      cancelAnimationFrame(frame); frame = requestAnimationFrame(place);
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !popup.current?.contains(event.target)) close(false);
    }
    place();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", queue);
    window.addEventListener("scroll", queue, true);
    window.addEventListener("aim4price:canvas-geometry", queue);
    window.visualViewport?.addEventListener("resize", queue);
    window.visualViewport?.addEventListener("scroll", queue);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", queue);
      window.removeEventListener("scroll", queue, true);
      window.removeEventListener("aim4price:canvas-geometry", queue);
      window.visualViewport?.removeEventListener("resize", queue);
      window.visualViewport?.removeEventListener("scroll", queue);
    };
  }, [open, props.disabled, options.length, searchable]);
  const mountPopup = useCallback((element: HTMLDivElement | null) => {
    popup.current = element;
    if (element) (search.current ?? listbox.current ?? element).focus({ preventScroll: true });
  }, []);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, open, id]);

  return <span ref={root} className={`${owner.ownerSelect} ${styles.root} ${className ?? ""}`} data-admin-select>
    <select {...props} ref={native} className={styles.native} hidden aria-hidden="true" tabIndex={-1} onChange={event => { setUncontrolled(event.target.value); props.onChange?.(event); }}>{children}</select>
    <span id={`${id}-label`} className={styles.srOnly}>{label}</span>
    <button ref={trigger} type="button" className={`${owner.button} ${styles.trigger} ${open ? owner.buttonOpen : ""}`} disabled={props.disabled}
      role="combobox" aria-label={label} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined} aria-describedby={props["aria-describedby"]}
      onClick={() => open ? close() : show()} onKeyDown={event => { if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); show(); } }}>
      <span id={`${id}-value`} className={styles.value} title={selected?.label}>{selected?.label ?? "Choose an option"}</span>
      <svg className={owner.chevron} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    {open && position && typeof document !== "undefined" ? createPortal(
      <div ref={mountPopup} className={`${owner.ownerSelect} ${owner.menu} ${styles.menu}`} style={position} data-admin-select-menu data-dropdown-overlay-portal="true" onKeyDown={handleKeys}>
        {searchable ? <input ref={search} className={styles.search} type="search" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-label={`Search ${label.toLocaleLowerCase()}`} placeholder="Search options" value={query} onChange={event => { setQuery(event.target.value); setActive(Math.max(0, options.filter(option => option.label.toLocaleLowerCase().includes(event.target.value.toLocaleLowerCase())).findIndex(option => !option.disabled))); }} aria-controls={id} aria-activedescendant={visible[active] ? `${id}-${active}` : undefined} /> : null}
        <div ref={listbox} id={id} tabIndex={-1} role="listbox" aria-label={label} aria-activedescendant={visible[active] ? `${id}-${active}` : undefined} className={styles.options}>
          {visible.map((option, index) => <button key={option.value} id={`${id}-${index}`} type="button" role="option" tabIndex={-1} aria-selected={option.value === value} disabled={option.disabled}
            className={`${owner.option} ${styles.option} ${option.value === value ? owner.optionActive : ""} ${index === active ? styles.active : ""}`} onPointerMove={() => setActive(index)} onClick={() => choose(option)}>
            <span>{option.label}</span><span className={owner.check} aria-hidden="true">✓</span>
          </button>)}
          {!visible.length ? <p className={styles.empty} role="status">No matching options</p> : null}
        </div>
      </div>, document.body) : null}
  </span>;
}
