import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { WorkspaceRole } from '@prisma/client';

export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Not authorized for this workspace') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface AuthedContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

/**
 * The single choke point every API route and Slack-triggered server action
 * must pass through before touching workspace-scoped data. It:
 *   1. Requires a valid session (throws UnauthorizedError otherwise)
 *   2. Requires actual WorkspaceMember membership for the requested
 *      workspaceId (throws ForbiddenError otherwise) — this is what
 *      enforces tenant isolation. A logged-in user from Workspace A can
 *      never read/write Workspace B's data through this path.
 */
export async function requireWorkspaceAccess(workspaceId: string): Promise<AuthedContext> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new UnauthorizedError();

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) throw new ForbiddenError();

  return { userId, workspaceId, role: membership.role };
}

export async function requireWorkspaceAdmin(workspaceId: string): Promise<AuthedContext> {
  const ctx = await requireWorkspaceAccess(workspaceId);
  if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN') {
    throw new ForbiddenError('This action requires an admin or owner role');
  }
  return ctx;
}

export async function requireSession(): Promise<{ userId: string; email: string }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email;
  if (!userId || !email) throw new UnauthorizedError();
  return { userId, email };
}
