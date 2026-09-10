export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startPhoneNotificationSender } = await import('./lib/push-runtime');
    await startPhoneNotificationSender();
  }
}
