import { prisma } from '@/lib/prisma';

interface AuditEntry {
  workspaceId?: string;
  userId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}

/** Central audit-log writer. Never pass tokens/secrets in `metadata` — this
 *  is stored and displayed, unlike application logs. */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      action: entry.action,
      metadata: entry.metadata as any,
    },
  });
}
