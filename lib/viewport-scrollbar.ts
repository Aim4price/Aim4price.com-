export type ViewportScrollbarMetrics = Readonly<{
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}>;

type PointerCoordinates = Readonly<{
  clientX: number;
  clientY: number;
}>;

function readViewportScrollbarMetrics(): ViewportScrollbarMetrics {
  if (typeof document === 'undefined') {
    return { clientWidth: 0, clientHeight: 0, scrollWidth: 0, scrollHeight: 0 };
  }

  const viewport = document.documentElement;
  const scroller = document.scrollingElement ?? viewport;

  return {
    clientWidth: viewport.clientWidth,
    clientHeight: viewport.clientHeight,
    scrollWidth: scroller.scrollWidth,
    scrollHeight: scroller.scrollHeight,
  };
}

export function isViewportScrollbarInteraction(
  event: PointerCoordinates,
  metrics: ViewportScrollbarMetrics = readViewportScrollbarMetrics(),
): boolean {
  const hasVerticalScrollbar = metrics.scrollHeight > metrics.clientHeight;
  const hasHorizontalScrollbar = metrics.scrollWidth > metrics.clientWidth;

  return (
    (hasVerticalScrollbar && event.clientX >= metrics.clientWidth) ||
    (hasHorizontalScrollbar && event.clientY >= metrics.clientHeight)
  );
}
