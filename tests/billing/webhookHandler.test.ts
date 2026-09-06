import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  subscription: { upsert: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/billing/stripe', () => ({
  getStripeClient: () => ({ subscriptions: { retrieve: vi.fn() } }),
}));

const { handleStripeEvent } = await import('@/lib/billing/webhookHandler');

function fakeSubscriptionEvent(overrides: Record<string, any> = {}) {
  return {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: process.env.STRIPE_PRICE_PRO_MONTHLY } }] },
        metadata: { workspaceId: 'ws_1' },
        ...overrides,
      },
    },
  } as any;
}

describe('handleStripeEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('syncs an active PRO subscription to the workspace', async () => {
    await handleStripeEvent(fakeSubscriptionEvent());

    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws_1' },
        create: expect.objectContaining({ plan: 'PRO', status: 'ACTIVE' }),
        update: expect.objectContaining({ plan: 'PRO', status: 'ACTIVE' }),
      })
    );
  });

  it('maps a canceled Stripe status to CANCELED', async () => {
    await handleStripeEvent(fakeSubscriptionEvent({ status: 'canceled' }));
    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ status: 'CANCELED' }) })
    );
  });

  it('never trusts a subscription event with no workspaceId metadata — logs and skips instead of guessing', async () => {
    await handleStripeEvent(fakeSubscriptionEvent({ metadata: {} }));
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'stripe.webhook.missing_workspace_id' }) })
    );
  });

  it('marks the workspace PAST_DUE on a failed invoice payment', async () => {
    await handleStripeEvent({
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_1', subscription_details: { metadata: { workspaceId: 'ws_1' } } } },
    } as any);

    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
      data: { status: 'PAST_DUE' },
    });
  });

  it('silently ignores event types it does not handle', async () => {
    await expect(handleStripeEvent({ type: 'some.other.event', data: { object: {} } } as any)).resolves.toBeUndefined();
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });
});
