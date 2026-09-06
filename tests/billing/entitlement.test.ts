import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  subscription: { findUnique: vi.fn() },
  usage: { findUnique: vi.fn(), upsert: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const { getEntitlement, requireActiveEntitlement, requireFeature, assertWithinAnalysisLimit, EntitlementError } = await import(
  '@/lib/billing/entitlement'
);

describe('getEntitlement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults an un-provisioned workspace to an active trial', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    const entitlement = await getEntitlement('ws_1');
    expect(entitlement.plan).toBe('TRIAL');
    expect(entitlement.isActive).toBe(true);
    expect(entitlement.features.ghostWorkDetection).toBe(false);
  });

  it('treats an expired trial as inactive even though status is TRIALING', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: 'TRIAL',
      status: 'TRIALING',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
    });
    const entitlement = await getEntitlement('ws_1');
    expect(entitlement.isActive).toBe(false);
  });

  it('unlocks GitHub integration and ghost work detection on PRO', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'PRO', status: 'ACTIVE', trialEndsAt: null });
    const entitlement = await getEntitlement('ws_1');
    expect(entitlement.features.githubIntegration).toBe(true);
    expect(entitlement.features.ghostWorkDetection).toBe(true);
    expect(entitlement.features.advancedAnalytics).toBe(false); // Business-only
  });

  it('treats PAST_DUE as inactive', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'PRO', status: 'PAST_DUE', trialEndsAt: null });
    const entitlement = await getEntitlement('ws_1');
    expect(entitlement.isActive).toBe(false);
  });
});

describe('requireActiveEntitlement / requireFeature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws EntitlementError for an inactive/canceled workspace', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'PRO', status: 'CANCELED', trialEndsAt: null });
    await expect(requireActiveEntitlement('ws_1')).rejects.toThrow(EntitlementError);
  });

  it('throws EntitlementError when requiring a feature the plan does not include', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'TRIAL', status: 'TRIALING', trialEndsAt: null });
    await expect(requireFeature('ws_1', 'githubIntegration')).rejects.toThrow(EntitlementError);
  });

  it('never trusts a client-supplied plan — only the DB-backed subscription decides', async () => {
    // Simulates the exact attack this function exists to prevent: nothing
    // in this call path accepts a plan/status argument from outside.
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'TRIAL', status: 'TRIALING', trialEndsAt: null });
    await expect(requireFeature('ws_1', 'advancedAnalytics')).rejects.toThrow(EntitlementError);
  });
});

describe('assertWithinAnalysisLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows the request when usage is below the plan limit', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'TRIAL', status: 'TRIALING', trialEndsAt: null });
    mockPrisma.usage.findUnique.mockResolvedValue({ analysesCount: 5 });
    await expect(assertWithinAnalysisLimit('ws_1')).resolves.toBeUndefined();
  });

  it('rejects once the monthly analysis limit is reached', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'TRIAL', status: 'TRIALING', trialEndsAt: null });
    mockPrisma.usage.findUnique.mockResolvedValue({ analysesCount: 30 }); // TRIAL limit is 30
    await expect(assertWithinAnalysisLimit('ws_1')).rejects.toThrow(EntitlementError);
  });
});
