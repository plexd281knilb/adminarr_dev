export async function register() {
  // Only run cron jobs in the NodeJS runtime (not Edge/Browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamically import the cron logic so it doesn't bloat the initial bundle
    const { initCron } = await import('@/lib/cron');
    initCron();
  }
}