/** Detect native scrollbar gutters without treating nearby content as a scrollbar. */
export function isScrollbarInteraction(event: MouseEvent): boolean {
  const root = document.documentElement;
  // Include reserved viewport gutters, even if content resized during the gesture.
  if ((window.innerWidth > root.clientWidth && event.clientX >= root.clientWidth)
    || (window.innerHeight > root.clientHeight && event.clientY >= root.clientHeight)) return true;

  if (!(event.target instanceof HTMLElement)) return false;
  const element = event.target;
  if (element === root || element === document.body) return false;
  const rect = element.getBoundingClientRect();
  if (!element.offsetWidth || !element.offsetHeight) return false;
  // Rect coordinates include the website's CSS zoom; client/offset sizes do not.
  const scaleX = rect.width / element.offsetWidth;
  const scaleY = rect.height / element.offsetHeight;
  const x = (event.clientX - rect.left) / scaleX;
  const y = (event.clientY - rect.top) / scaleY;
  const style = getComputedStyle(element);
  const left = parseFloat(style.borderLeftWidth) || 0;
  const right = parseFloat(style.borderRightWidth) || 0;
  const top = parseFloat(style.borderTopWidth) || 0;
  const bottom = parseFloat(style.borderBottomWidth) || 0;
  const verticalGutter = element.offsetWidth - element.clientWidth - left - right;
  const horizontalGutter = element.offsetHeight - element.clientHeight - top - bottom;
  const scrollable = (overflow: string) => /^(auto|scroll|overlay)$/.test(overflow);
  const vertical = verticalGutter > 0 && scrollable(style.overflowY)
    && y >= top && y < element.offsetHeight - bottom
    // clientLeft is rounded; a fractional border at CSS zoom is not an RTL gutter.
    && (element.clientLeft > left + 1
      ? x >= left && x < element.clientLeft
      : x >= element.clientLeft + element.clientWidth && x < element.offsetWidth - right);
  const horizontal = horizontalGutter > 0 && scrollable(style.overflowX)
    && x >= left && x < element.offsetWidth - right
    && y >= element.clientTop + element.clientHeight && y < element.offsetHeight - bottom;
  return vertical || horizontal;
}

/** Keep native scrolling, but do not send scrollbar gestures to outside-dismiss handlers. */
export function installScrollbarInteractionGuard(): () => void {
  let scrollbarGesture = false;
  const handle = (event: MouseEvent) => {
    const onScrollbar = isScrollbarInteraction(event);
    // Keyboard activation must not inherit a previous native scrollbar gesture.
    if (event.type === 'click' && event.detail === 0 && !onScrollbar) scrollbarGesture = false;
    if (event.type === 'pointerdown' || event.type === 'mousedown') {
      scrollbarGesture = onScrollbar;
    }
    if (onScrollbar || scrollbarGesture) {
      // Never preventDefault: the browser must still drag the thumb / scroll the track.
      event.stopImmediatePropagation();
    }
    if (event.type === 'click') scrollbarGesture = false;
  };
  const reset = () => { scrollbarGesture = false; };
  const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const;
  for (const type of events) window.addEventListener(type, handle, true);
  window.addEventListener('blur', reset);
  window.addEventListener('pointercancel', reset);
  return () => {
    for (const type of events) window.removeEventListener(type, handle, true);
    window.removeEventListener('blur', reset);
    window.removeEventListener('pointercancel', reset);
  };
}
