export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMaintenanceReminderTestSender } = await import('./lib/maintenance-reminder-runtime');
    await startMaintenanceReminderTestSender();
    const { startAverageUsage } = await import('./lib/average-usage-runtime');
    await startAverageUsage();
    const { startAutomaticValuations } = await import('./lib/automatic-valuation-runtime');
    await startAutomaticValuations();
    const { startPhoneNotificationSender } = await import('./lib/push-runtime');
    await startPhoneNotificationSender();
    const { startPaidBillImports } = await import('./lib/sage-paid-runtime');
    startPaidBillImports();
    const { startBillingSender } = await import('./lib/billing-mail');
    await startBillingSender();
  }
}

