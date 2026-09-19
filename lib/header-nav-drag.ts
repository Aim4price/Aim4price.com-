/** Advance one item per completed drag, without activating a link on release. */
export function attachHeaderNavDrag(element: HTMLElement, onStep: (direction: -1 | 1) => void) {
  let gesture: {
    pointerId: number;
    x: number;
    y: number;
    axis: 'horizontal' | 'vertical' | null;
  } | null = null;
  let suppressPointerClick = false;

  const finish = () => {
    const current = gesture;
    gesture = null;
    element.removeAttribute('data-dragging');
    if (current && element.hasPointerCapture(current.pointerId)) {
      element.releasePointerCapture(current.pointerId);
    }
  };

  const down = (event: PointerEvent) => {
    // A second finger belongs to the browser's pinch gesture.
    if (!event.isPrimary) { finish(); return; }
    finish();
    suppressPointerClick = false;
    if (event.button !== 0) return;
    gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: null,
    };
  };

  const move = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 6) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical';
      suppressPointerClick = true;
    }
    if (gesture.axis !== 'horizontal') return;
    suppressPointerClick = true;
    if (!element.hasPointerCapture(event.pointerId)) element.setPointerCapture(event.pointerId);
    element.setAttribute('data-dragging', 'true');
    if (event.cancelable) event.preventDefault();
  };

  const up = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    // Use rendered pixels so the gesture feels the same at every website zoom.
    const shouldStep = gesture.axis === 'horizontal' && Math.abs(dx) >= 24;
    finish();
    if (shouldStep) onStep(dx < 0 ? 1 : -1);
  };
  const cancel = (event: PointerEvent) => {
    if (gesture?.pointerId === event.pointerId) finish();
  };
  const lostCapture = (event: PointerEvent) => {
    // Touch starts with implicit capture on the link. Moving capture to the rail
    // also bubbles that link's lost-capture event, which must not end our drag.
    if (event.target === element) cancel(event);
  };
  const click = (event: MouseEvent) => {
    // Keyboard activation has detail 0. A fresh pointerdown enables the next click.
    if (!suppressPointerClick || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressPointerClick = false;
  };
  const preventNativeDrag = (event: DragEvent) => event.preventDefault();

  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move, { passive: false });
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel);
  element.addEventListener('lostpointercapture', lostCapture);
  element.addEventListener('click', click, { capture: true });
  element.addEventListener('dragstart', preventNativeDrag);
  window.addEventListener('blur', finish);
  return () => {
    finish();
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', cancel);
    element.removeEventListener('lostpointercapture', lostCapture);
    element.removeEventListener('click', click, { capture: true });
    element.removeEventListener('dragstart', preventNativeDrag);
    window.removeEventListener('blur', finish);
  };
}
