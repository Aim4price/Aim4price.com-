export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutomaticValuations } = await import('./lib/automatic-valuation-runtime');
    await startAutomaticValuations();
    const { startPhoneNotificationSender } = await import('./lib/push-runtime');
    await startPhoneNotificationSender();
    const { startBillingSender } = await import('./lib/billing-mail');
    await startBillingSender();
  }
}
