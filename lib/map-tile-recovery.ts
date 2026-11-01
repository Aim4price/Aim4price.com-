type TileEvents = {
  on(event: string, listener: () => void): unknown;
};

/** Observe requests already made for the viewport; never retry or prefetch tiles. */
export function watchMapTileFailures(layer: TileEvents, onUnavailable: () => void) {
  let failed = 0;
  let loaded = 0;
  let reported = false;
  const report = () => {
    if (reported) return;
    reported = true;
    onUnavailable();
  };
  layer.on('loading', () => {
    failed = 0;
    loaded = 0;
    reported = false;
  });
  layer.on('tileload', () => { loaded += 1; });
  layer.on('tileerror', () => {
    failed += 1;
    // A single lost image should not interrupt an otherwise usable map.
    if (failed >= 3) report();
  });
  layer.on('load', () => {
    // Also handle small viewports where fewer than three images were requested.
    if (failed > 0 && loaded === 0) report();
  });
}
