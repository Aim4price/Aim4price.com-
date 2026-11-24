"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./SheetColumnHeader.module.css";

type Layout = { order: string[]; widths: Record<string, number> };
const emptyLayout: Layout = { order: [], widths: {} };
const minWidth = 100;
const maxWidth = 640;

function bounded(width: number) {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
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
  index: number;
  count: number;
  width: number;
  onMove: (direction: number) => void;
  onResize: (width: number, persist: boolean) => void;
};

export default function SheetColumnHeader({ label, hint, index, count, width, onMove, onResize }: HeaderProps) {
  const drag = useRef<{ x: number; width: number; scale: number; pointer: number } | null>(null);
  function dragWidth(event: PointerEvent<HTMLSpanElement>) {
    const start = drag.current!;
    return bounded(start.width + (event.clientX - start.x) / start.scale);
  }

  return <div className={styles.header}>
    <span className={styles.caption}><strong title={label}>{label}</strong>{hint && <small title={hint}>{hint}</small>}</span>
    {count > 1 && <span className={styles.moves}>
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
      aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={width} aria-valuetext={`${width} pixels`}
      title="Drag to resize, or use the left and right arrow keys"
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary) return;
        const cell = event.currentTarget.closest("th")!;
        drag.current = { x: event.clientX, width, scale: cell.getBoundingClientRect().width / cell.offsetWidth || 1, pointer: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={event => { if (drag.current?.pointer === event.pointerId) onResize(dragWidth(event), false); }}
      onPointerUp={event => {
        if (drag.current?.pointer !== event.pointerId) return;
        onResize(dragWidth(event), true);
        drag.current = null;
      }}
      onLostPointerCapture={() => { if (drag.current) { onResize(drag.current.width, false); drag.current = null; } }}
      onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onResize(bounded(width + (event.key === "ArrowLeft" ? -12 : 12)), true);
      }} />
  </div>;
}
