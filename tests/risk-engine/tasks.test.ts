import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  risk: { findFirstOrThrow: vi.fn() },
  task: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockForWorkspace = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/integrations/github', () => ({
  GitHubIntegration: { forWorkspace: mockForWorkspace },
}));

const { createTaskFromRisk } = await import('@/lib/risk-engine/tasks');

const fakeRisk = {
  id: 'risk_1',
  workspaceId: 'ws_1',
  title: 'API is blocked',
  description: 'desc',
  evidence: [{ quote: 'The payment API is still not ready.' }],
  recommendations: [{ id: 'rec_1', text: 'Assign API blocker' }],
  project: null,
};

describe('createTaskFromRisk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the risk lookup to the caller\'s own workspace (tenant isolation)', async () => {
    mockPrisma.risk.findFirstOrThrow.mockResolvedValue(fakeRisk);
    mockPrisma.task.create.mockResolvedValue({ id: 'task_1' });

    await createTaskFromRisk({ workspaceId: 'ws_1', riskId: 'risk_1' });

    expect(mockPrisma.risk.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'risk_1', workspaceId: 'ws_1' } })
    );
  });

  it('creates an internal task using the first recommendation when none is specified', async () => {
    mockPrisma.risk.findFirstOrThrow.mockResolvedValue(fakeRisk);
    mockPrisma.task.create.mockResolvedValue({ id: 'task_1' });

    const result = await createTaskFromRisk({ workspaceId: 'ws_1', riskId: 'risk_1' });

    expect(result.externalUrl).toBeNull();
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Assign API blocker', integrationType: 'INTERNAL' }) })
    );
  });

  it('creates a real GitHub issue when integrationType is GITHUB and the integration is connected', async () => {
    mockPrisma.risk.findFirstOrThrow.mockResolvedValue(fakeRisk);
    mockPrisma.task.create.mockResolvedValue({ id: 'task_1' });
    mockForWorkspace.mockResolvedValue({
      createIssue: vi.fn().mockResolvedValue({ externalId: '7', externalUrl: 'https://github.com/a/b/issues/7' }),
    });

    const result = await createTaskFromRisk({ workspaceId: 'ws_1', riskId: 'risk_1', integrationType: 'GITHUB' });

    expect(result.externalUrl).toBe('https://github.com/a/b/issues/7');
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ integrationType: 'GITHUB', externalUrl: 'https://github.com/a/b/issues/7' }) })
    );
  });

  it('falls back to an internal task if GitHub is requested but the API call fails', async () => {
    mockPrisma.risk.findFirstOrThrow.mockResolvedValue(fakeRisk);
    mockPrisma.task.create.mockResolvedValue({ id: 'task_1' });
    mockForWorkspace.mockRejectedValue(new Error('GitHub not connected'));

    const result = await createTaskFromRisk({ workspaceId: 'ws_1', riskId: 'risk_1', integrationType: 'GITHUB' });

    expect(result.externalUrl).toBeNull();
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ integrationType: 'INTERNAL' }) })
    );
  });
});
