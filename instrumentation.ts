export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production' || process.env.AIM4PRICE_PUSH_DISABLED === '1') return;
  const { dispatchPhoneNotifications } = await import('./lib/push-dispatch');
  const state = globalThis as typeof globalThis & { aim4pricePushTimer?: ReturnType<typeof setInterval> };
  if (state.aim4pricePushTimer) return;
  let running = false;
  state.aim4pricePushTimer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await dispatchPhoneNotifications(); }
    catch { console.warn('Phone notification sender unavailable; will retry.'); }
    finally { running = false; }
  }, 60_000);
  state.aim4pricePushTimer.unref();
}
