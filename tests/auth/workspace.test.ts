import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetServerSession = vi.fn();
const mockPrisma = {
  workspaceMember: { findUnique: vi.fn() },
};

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const { requireWorkspaceAccess, requireWorkspaceAdmin, UnauthorizedError, ForbiddenError } = await import(
  '@/lib/auth/workspace'
);

describe('requireWorkspaceAccess — tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws UnauthorizedError when there is no session', async () => {
    mockGetServerSession.mockResolvedValue(null);
    await expect(requireWorkspaceAccess('ws_a')).rejects.toThrow(UnauthorizedError);
  });

  it('throws ForbiddenError when the user is not a member of the requested workspace', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_1' } });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

    // This is the critical cross-tenant case: user_1 belongs to workspace
    // ws_a but is requesting data scoped to ws_b — must be rejected.
    await expect(requireWorkspaceAccess('ws_b')).rejects.toThrow(ForbiddenError);
  });

  it('succeeds and returns the role when membership exists', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_1' } });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    const ctx = await requireWorkspaceAccess('ws_a');
    expect(ctx).toEqual({ userId: 'user_1', workspaceId: 'ws_a', role: 'MEMBER' });
  });

  it('scopes the membership lookup to the exact (workspaceId, userId) pair — never just userId', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_1' } });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: 'OWNER' });

    await requireWorkspaceAccess('ws_a');

    expect(mockPrisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 'ws_a', userId: 'user_1' } },
    });
  });
});

describe('requireWorkspaceAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a plain MEMBER role', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_1' } });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    await expect(requireWorkspaceAdmin('ws_a')).rejects.toThrow(ForbiddenError);
  });

  it('allows OWNER and ADMIN roles', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_1' } });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: 'OWNER' });
    await expect(requireWorkspaceAdmin('ws_a')).resolves.toBeDefined();

    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    await expect(requireWorkspaceAdmin('ws_a')).resolves.toBeDefined();
  });
});
