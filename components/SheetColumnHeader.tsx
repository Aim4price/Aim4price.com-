"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./SheetColumnHeader.module.css";

type Layout = { order: string[]; widths: Record<string, number> };
const emptyLayout: Layout = { order: [], widths: {} };
const minWidth = 64;

function bounded(width: number) {
  return Math.max(minWidth, Math.round(width));
}

export function useSheetColumns(storageKey: string) {
  const [layout, setLayout] = useState(emptyLayout);
  const current = useRef(emptyLayout);

  useEffect(() => {
    let restored = emptyLayout;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved?.order) && saved.widths && typeof saved.widths === "object") {
        restored = {
          order: [...new Set<string>(saved.order.filter((id: unknown) => typeof id === "string"))],
          widths: Object.fromEntries(Object.entries(saved.widths).filter(([, w]) => typeof w === "number" && Number.isFinite(w)).map(([id, w]) => [id, bounded(Number(w))])),
        };
      }
    } catch { /* Preferences are optional in private browsing. */ }
    current.current = restored;
    setLayout(restored);
  }, [storageKey]);

  function update(next: Layout, persist: boolean) {
    current.current = next;
    setLayout(next);
    if (persist) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the layout for this session. */ }
    }
  }

  function ordered<T extends string>(ids: readonly T[]): T[] {
    const rank = new Map(layout.order.map((id, index) => [id, index]));
    return [...ids].sort((a, b) => (rank.get(a) ?? rank.size) - (rank.get(b) ?? rank.size));
  }

  function move(ids: readonly string[], visible: readonly string[], id: string, direction: number) {
    const other = visible[visible.indexOf(id) + direction];
    if (other === undefined) return;
    const order = ordered(ids);
    const from = order.indexOf(id), to = order.indexOf(other);
    if (from < 0 || to < 0) return;
    [order[from], order[to]] = [order[to], order[from]];
    update({ ...current.current, order }, true);
  }

  function resize(id: string, width: number, persist: boolean) {
    update({ ...current.current, widths: { ...current.current.widths, [id]: bounded(width) } }, persist);
  }

  return { ordered, move, resize, widths: layout.widths };
}

type HeaderProps = {
  label: string;
  hint?: string;
  index?: number;
  count?: number;
  width: number;
  getValues: () => string[];
  onMove?: (direction: number) => void;
  onResize: (width: number, persist: boolean) => void;
};

type Drag = {
  pointer: number;
  startX: number;
  x: number;
  width: number;
  scale: number;
  host: HTMLElement;
  startLeft: number;
  nextLeft?: number;
  frame?: number;
};

export default function SheetColumnHeader({ label, hint, index, count, width, getValues, onMove, onResize }: HeaderProps) {
  const drag = useRef<Drag | null>(null);
  useEffect(() => () => { if (drag.current?.frame !== undefined) cancelAnimationFrame(drag.current.frame); }, []);

  function dragWidth(d: Drag, left = d.nextLeft ?? d.host.scrollLeft) {
    return bounded(d.width + (d.x - d.startX) / d.scale + left - d.startLeft);
  }

  function panAtEdge() {
    const d = drag.current;
    if (!d) return;
    d.frame = undefined;
    // Apply the scroll after React has laid out the wider column, even for the last column.
    if (d.nextLeft !== undefined) {
      d.host.scrollLeft = d.nextLeft;
      d.nextLeft = undefined;
    }
    const view = d.host.getBoundingClientRect();
    const edge = 20 * d.scale;
    const fromRight = (d.x - view.right + edge) / edge;
    const fromLeft = (d.x - view.left - edge) / edge;
    const speed = fromRight > 0 ? Math.min(1, fromRight) : Math.max(-1, Math.min(0, fromLeft));
    const left = Math.max(0, d.host.scrollLeft + Math.round(speed * 12));
    if (left === d.host.scrollLeft || (speed < 0 && dragWidth(d) <= minWidth)) return;
    d.nextLeft = left;
    onResize(dragWidth(d), false);
    d.frame = requestAnimationFrame(panAtEdge);
  }

  function fit(grip: HTMLElement) {
    const cell = grip.closest('th');
    const context = document.createElement('canvas').getContext('2d');
    if (!cell || !context) return;
    const input = cell.closest('table')?.tBodies[0]?.rows[0]?.cells[cell.cellIndex]?.querySelector('input');
    function padding(element: Element) {
      const style = getComputedStyle(element);
      return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    }
    const measure = (element: Element, values: string[]) => {
      const style = getComputedStyle(element);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      let longest = 0;
      for (const value of values) longest = Math.max(longest, context.measureText(value).width);
      return Math.ceil(longest);
    };
    const heading = cell.querySelector('strong')!;
    const note = cell.querySelector('small');
    const moves = cell.querySelector<HTMLElement>('[data-column-moves]');
    const caption = Math.max(measure(heading, [label]), note && hint ? measure(note, [hint]) : 0);
    const headerWidth = padding(cell) + caption + (moves?.offsetWidth ?? 0) + 12;
    const contentWidth = input ? padding(input) + measure(input, getValues()) + 6 : 0;
    onResize(Math.max(headerWidth, contentWidth), true);
  }

  function endDrag(event: PointerEvent<HTMLSpanElement>, commit: boolean) {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    if (d.frame !== undefined) cancelAnimationFrame(d.frame);
    d.x = event.clientX;
    drag.current = null;
    onResize(commit ? dragWidth(d) : d.width, commit);
  }

  return <div className={styles.header} data-compact={width < 132 || undefined}>
    <span className={styles.caption}><strong title={label}>{label}</strong>{hint && <small title={hint}>{hint}</small>}</span>
    {onMove && count !== undefined && count > 1 && <span className={styles.moves} data-column-moves>
      {[-1, 1].map(direction => {
        const side = direction < 0 ? "left" : "right";
        return <button key={side} type="button" title={`Move ${label} ${side}`} aria-label={`Move ${label} ${side}`}
          disabled={direction < 0 ? index === 0 : index === count - 1} onClick={event => {
            const button = event.currentTarget;
            onMove(direction);
            requestAnimationFrame(() => {
              const target = button.disabled ? button.parentElement?.querySelector<HTMLButtonElement>("button:enabled") : button;
              target?.focus({ preventScroll: true });
              target?.closest("th")?.scrollIntoView({ block: "nearest", inline: "nearest" });
            });
          }}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={direction < 0 ? "m9.5 4-4 4 4 4" : "m6.5 4 4 4-4 4"} /></svg>
        </button>;
      })}
    </span>}
    <span className={styles.grip} role="separator" tabIndex={0} aria-label={`Resize ${label} column`} aria-orientation="vertical"
      aria-valuemin={minWidth} aria-valuemax={Number.MAX_SAFE_INTEGER} aria-valuenow={width} aria-valuetext={`${width} pixels`}
      title="Drag or use arrow keys to resize. Double-click or press Enter to fit all rows."
      onDoubleClick={event => fit(event.currentTarget)}
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary) return;
        const cell = event.currentTarget.closest("th")!;
        const host = cell.closest<HTMLElement>("[data-sheet-scroll]")!;
        drag.current = { startX: event.clientX, x: event.clientX, width, host, startLeft: host.scrollLeft,
          scale: cell.getBoundingClientRect().width / cell.offsetWidth || 1, pointer: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={event => {
        const d = drag.current;
        if (!d || d.pointer !== event.pointerId || event.clientX === d.x) return;
        d.x = event.clientX;
        onResize(dragWidth(d), false);
        if (d.frame === undefined) d.frame = requestAnimationFrame(panAtEdge);
      }}
      onPointerUp={event => endDrag(event, true)}
      onPointerCancel={event => endDrag(event, false)}
      onLostPointerCapture={event => endDrag(event, false)}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.preventDefault();
          fit(event.currentTarget);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const step = event.shiftKey ? 48 : 12;
          onResize(bounded(width + (event.key === "ArrowLeft" ? -step : step)), true);
          const grip = event.currentTarget;
          requestAnimationFrame(() => grip.scrollIntoView({ block: "nearest", inline: "nearest" }));
        }
      }} />
  </div>;
}
