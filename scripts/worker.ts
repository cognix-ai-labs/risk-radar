/**
 * Polling worker for pending AnalysisRun jobs. Run alongside the Next.js
 * server in development (`npm run worker`) and as a separate process/
 * container in production. Deliberately simple (poll a table) rather than
 * Redis/BullMQ — sufficient for MVP volume, and the enqueue/consume
 * boundary (lib/jobs/queue.ts + this file) is where a real queue would
 * slot in later without touching call sites.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { processAnalysisRun } from '../src/lib/risk-engine/analyze';

const POLL_INTERVAL_MS = 3000;
let shuttingDown = false;

async function pollOnce(): Promise<void> {
  const next = await prisma.analysisRun.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  if (!next) return;

  console.log(`[worker] processing analysis run ${next.id} (workspace ${next.workspaceId})`);
  try {
    await processAnalysisRun(next.id);
    console.log(`[worker] completed analysis run ${next.id}`);
  } catch (error) {
    console.error(`[worker] analysis run ${next.id} failed:`, error instanceof Error ? error.message : error);
  }
}

async function loop(): Promise<void> {
  while (!shuttingDown) {
    await pollOnce().catch((err) => console.error('[worker] poll error:', err));
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

process.on('SIGINT', () => {
  shuttingDown = true;
});
process.on('SIGTERM', () => {
  shuttingDown = true;
});

console.log('[worker] started, polling for pending analysis runs...');
loop();
