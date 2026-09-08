export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Registering background services in nodejs runtime...');
    const { startTimelineMonitor } = await import('@/lib/services/codex-timeline.service');
    startTimelineMonitor();
  }
}
