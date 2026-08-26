export type DropdownOverlayRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type DropdownOverlayViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DropdownOverlayPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
};

export function calculateDropdownOverlayPosition({
  anchor,
  viewport,
  contentWidth,
  contentHeight,
  gap,
  gutter,
  maxHeight,
  matchAnchorWidth,
  minimumWidth = 0,
}: {
  anchor: DropdownOverlayRect;
  viewport: DropdownOverlayViewport;
  contentWidth: number;
  contentHeight: number;
  gap: number;
  gutter: number;
  maxHeight: number;
  matchAnchorWidth: boolean;
  minimumWidth?: number;
}): DropdownOverlayPosition {
  const viewportRight = viewport.left + viewport.width;
  const viewportBottom = viewport.top + viewport.height;
  const maximumWidth = Math.max(1, viewport.width - (gutter * 2));
  const width = Math.min(
    maximumWidth,
    Math.max(
      anchor.width,
      minimumWidth,
      matchAnchorWidth ? 0 : contentWidth,
    ),
  );
  const roomBelow = Math.max(0, viewportBottom - anchor.bottom - gap - gutter);
  const roomAbove = Math.max(0, anchor.top - viewport.top - gap - gutter);
  const preferredHeight = Math.min(maxHeight, Math.max(contentHeight, 1));
  const openAbove = roomBelow < preferredHeight && roomAbove > roomBelow;
  const availableHeight = Math.max(1, openAbove ? roomAbove : roomBelow);
  const resolvedMaxHeight = Math.min(maxHeight, availableHeight);
  const renderedHeight = Math.min(preferredHeight, resolvedMaxHeight);
  const minimumLeft = viewport.left + gutter;
  const maximumLeft = Math.max(minimumLeft, viewportRight - gutter - width);
  const left = Math.min(Math.max(anchor.left, minimumLeft), maximumLeft);
  const unclampedTop = openAbove
    ? anchor.top - gap - renderedHeight
    : anchor.bottom + gap;
  const minimumTop = viewport.top + gutter;
  const maximumTop = Math.max(minimumTop, viewportBottom - gutter - renderedHeight);
  const top = Math.min(Math.max(unclampedTop, minimumTop), maximumTop);

  return {
    left,
    top,
    width,
    maxHeight: resolvedMaxHeight,
    placement: openAbove ? 'top' : 'bottom',
  };
}
