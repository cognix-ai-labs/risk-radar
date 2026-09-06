import { prisma } from '@/lib/prisma';
import { getPlanDefinition } from './plans';
import type { PlanTier, SubscriptionStatus } from '@prisma/client';

export interface Entitlement {
  plan: PlanTier;
  status: SubscriptionStatus;
  isActive: boolean; // true for TRIALING or ACTIVE; false otherwise
  maxChannels: number | null;
  maxAnalysesPerMonth: number | null;
  features: ReturnType<typeof getPlanDefinition>['features'];
}

const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIALING', 'ACTIVE'];

/**
 * The ONLY place that should be consulted to decide what a workspace is
 * allowed to do. Always reads from the database — never from a client-sent
 * plan/status value. API routes and Slack handlers must call this before
 * gating any paid feature.
 */
export async function getEntitlement(workspaceId: string): Promise<Entitlement> {
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });

  const plan = subscription?.plan ?? 'TRIAL';
  const status = subscription?.status ?? 'TRIALING';
  const definition = getPlanDefinition(plan);

  const trialExpired =
    plan === 'TRIAL' && subscription?.trialEndsAt != null && subscription.trialEndsAt.getTime() < Date.now();

  return {
    plan,
    status,
    isActive: ACTIVE_STATUSES.includes(status) && !trialExpired,
    maxChannels: definition.maxChannels,
    maxAnalysesPerMonth: definition.maxAnalysesPerMonth,
    features: definition.features,
  };
}

export class EntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntitlementError';
  }
}

/** Throws if the workspace's subscription isn't active. Call at the top of
 *  any server action that requires a paid or trialing workspace. */
export async function requireActiveEntitlement(workspaceId: string): Promise<Entitlement> {
  const entitlement = await getEntitlement(workspaceId);
  if (!entitlement.isActive) {
    throw new EntitlementError('This workspace\'s subscription is not active. Please upgrade or renew billing.');
  }
  return entitlement;
}

export async function requireFeature(
  workspaceId: string,
  feature: keyof Entitlement['features']
): Promise<Entitlement> {
  const entitlement = await requireActiveEntitlement(workspaceId);
  if (!entitlement.features[feature]) {
    throw new EntitlementError(`The "${feature}" feature requires a higher plan.`);
  }
  return entitlement;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Server-side check before starting a new analysis run — enforces the
 *  monthly analysis-count limit for the workspace's plan. */
export async function assertWithinAnalysisLimit(workspaceId: string): Promise<void> {
  const entitlement = await requireActiveEntitlement(workspaceId);
  if (entitlement.maxAnalysesPerMonth == null) return;

  const usage = await prisma.usage.findUnique({
    where: { workspaceId_period: { workspaceId, period: currentPeriod() } },
  });

  if (usage && usage.analysesCount >= entitlement.maxAnalysesPerMonth) {
    throw new EntitlementError(
      `Monthly analysis limit reached (${entitlement.maxAnalysesPerMonth}) for the ${entitlement.plan} plan.`
    );
  }
}

export async function assertWithinChannelLimit(workspaceId: string, requestedCount: number): Promise<void> {
  const entitlement = await requireActiveEntitlement(workspaceId);
  if (entitlement.maxChannels == null) return;
  if (requestedCount > entitlement.maxChannels) {
    throw new EntitlementError(
      `The ${entitlement.plan} plan allows up to ${entitlement.maxChannels} channels; ${requestedCount} were selected.`
    );
  }
}

export async function recordAnalysisUsage(workspaceId: string, messagesAnalyzed: number): Promise<void> {
  const period = currentPeriod();
  await prisma.usage.upsert({
    where: { workspaceId_period: { workspaceId, period } },
    create: { workspaceId, period, analysesCount: 1, messagesIngested: messagesAnalyzed },
    update: { analysesCount: { increment: 1 }, messagesIngested: { increment: messagesAnalyzed } },
  });
}
