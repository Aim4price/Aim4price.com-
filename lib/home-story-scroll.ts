/** Consume one deliberate wheel/vertical-touch gesture per story step, including its momentum. */
export function attachHomeStoryScroll(
  element: HTMLElement,
  canStep: (direction: -1 | 1) => boolean,
  onStep: (direction: -1 | 1) => void,
) {
  let lastWheel = -Infinity;
  let lastStep = -Infinity;
  let total = 0;
  let consumed = false;
  let touch: { x: number; y: number; id: number } | null = null;
  let vertical = false;
  let horizontal = false;
  const excluded = (target: EventTarget | null) => target instanceof Element && !!target.closest('dialog, input, textarea, select, [contenteditable], [role="slider"]');
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || excluded(event.target) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const now = Date.now();
    if (now - lastWheel > 220) { total = 0; consumed = false; }
    lastWheel = now;
    const direction = event.deltaY > 0 ? 1 : -1;
    if (!consumed && !canStep(direction)) return;
    event.preventDefault();
    if (consumed || now - lastStep < 900) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
    if (Math.sign(delta) !== Math.sign(total)) total = 0;
    total += delta;
    if (Math.abs(total) < 90) return;
    consumed = true;
    lastStep = now;
    onStep(direction);
  };
  const start = (event: TouchEvent) => {
    touch = null; vertical = false; horizontal = false;
    if (event.touches.length !== 1 || excluded(event.target)) return;
    const p = event.touches[0];
    touch = { x: p.clientX, y: p.clientY, id: p.identifier };
  };
  const move = (event: TouchEvent) => {
    if (!touch) return;
    if (event.touches.length !== 1) { touch = null; return; }
    const p = event.touches[0];
    if (p.identifier !== touch.id) { touch = null; return; }
    const dx = Math.abs(p.clientX - touch.x), dy = Math.abs(p.clientY - touch.y);
    if (!vertical && !horizontal && Math.max(dx, dy) >= 12) {
      vertical = dy > dx * 1.2;
      horizontal = !vertical;
    }
    if (vertical && canStep(p.clientY < touch.y ? 1 : -1) && event.cancelable) event.preventDefault();
  };
  const end = (event: TouchEvent) => {
    const origin = touch;
    touch = null;
    if (!origin || !vertical || event.touches.length) return;
    const p = Array.from(event.changedTouches).find(p => p.identifier === origin.id);
    if (!p) return;
    const dy = origin.y - p.clientY;
    const direction = dy > 0 ? 1 : -1;
    if (Math.abs(dy) < 72 || !canStep(direction)) return;
    if (event.cancelable) event.preventDefault();
    if (Date.now() - lastStep < 900) return;
    lastStep = Date.now();
    onStep(direction);
  };
  const cancel = () => { touch = null; };
  element.addEventListener('wheel', wheel, { passive: false });
  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchmove', move, { passive: false });
  element.addEventListener('touchend', end, { passive: false });
  element.addEventListener('touchcancel', cancel);
  return () => {
    element.removeEventListener('wheel', wheel);
    element.removeEventListener('touchstart', start);
    element.removeEventListener('touchmove', move);
    element.removeEventListener('touchend', end);
    element.removeEventListener('touchcancel', cancel);
  };
}
