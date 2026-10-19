export async function startAutomaticValuations() {
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.AIM4PRICE_AUTOMATIC_VALUATIONS_DISABLED === '1' ||
      !(process.env.DATABASE_URL || process.env.PGHOST)) return;
  const state = globalThis as typeof globalThis & { aim4priceValuationTimer?: ReturnType<typeof setInterval> };
  if (state.aim4priceValuationTimer) return;
  const { ensureAutomaticValuationSchema } = await import('./automatic-valuation-schema');
  const { processAutomaticValuations } = await import('./automatic-valuation-worker');
  // Install capture before accepting writes; never run this during the build.
  await ensureAutomaticValuationSchema();
  let running = false;
  state.aim4priceValuationTimer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await processAutomaticValuations(); }
    catch { console.warn('Automatic asset values unavailable; queued updates will retry.'); }
    finally { running = false; }
  }, 5000);
  state.aim4priceValuationTimer.unref();
}
