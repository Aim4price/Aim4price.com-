/** Add one-step horizontal navigation without taking over vertical scrolling or pinch zoom. */
export function attachHomeStorySwipe(element: HTMLElement, onSwipe: (direction: -1 | 1) => void) {
  let start: { x: number; y: number; id: number } | null = null;
  let axis: 'horizontal' | 'vertical' | null = null;
  let suppressClickUntil = 0;

  const reset = () => { start = null; axis = null; };
  const blocked = () => Boolean(document.querySelector('[data-home-preview-dialog][open]'));
  const handleStart = (event: TouchEvent) => {
    reset();
    suppressClickUntil = 0;
    if (event.touches.length !== 1 || blocked()) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable], [role="slider"]')) return;
    const touch = event.touches[0];
    start = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
  };
  const handleMove = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length !== 1 || blocked()) { reset(); return; }
    const touch = event.touches[0];
    if (touch.identifier !== start.id) { reset(); return; }
    const dx = Math.abs(touch.clientX - start.x);
    const dy = Math.abs(touch.clientY - start.y);
    if (!axis && Math.max(dx, dy) >= 10) {
      axis = dx > dy * 1.2 ? 'horizontal' : 'vertical';
    }
    if (axis === 'horizontal' && event.cancelable) event.preventDefault();
  };
  const handleEnd = (event: TouchEvent) => {
    const origin = start;
    const horizontal = axis === 'horizontal';
    reset();
    if (!origin || !horizontal || event.touches.length || blocked()) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === origin.id);
    if (!touch) return;
    // A swipe beginning on a preview card must not open its dialog on release.
    suppressClickUntil = Date.now() + 700;
    if (event.cancelable) event.preventDefault();
    const dx = touch.clientX - origin.x;
    if (Math.abs(dx) >= 48) onSwipe(dx < 0 ? 1 : -1);
  };
  const handleClick = (event: MouseEvent) => {
    if (event.detail > 0 && Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  element.addEventListener('touchstart', handleStart, { passive: true });
  element.addEventListener('touchmove', handleMove, { passive: false });
  element.addEventListener('touchend', handleEnd, { passive: false });
  element.addEventListener('touchcancel', reset);
  element.addEventListener('click', handleClick, { capture: true });
  return () => {
    element.removeEventListener('touchstart', handleStart);
    element.removeEventListener('touchmove', handleMove);
    element.removeEventListener('touchend', handleEnd);
    element.removeEventListener('touchcancel', reset);
    element.removeEventListener('click', handleClick, { capture: true });
  };
}
