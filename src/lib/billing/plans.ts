import type { PlanTier } from '@prisma/client';

/**
 * Single source of truth for pricing/limits. Changing a price or limit is a
 * one-file edit — nothing else in the app should hardcode a plan number.
 * Actual Stripe Price IDs come from env so test/live mode can differ
 * without a code change.
 */
export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceMonthlyUsd: number;
  stripePriceEnvVar?: string;
  maxChannels: number | null; // null = unlimited
  maxAnalysesPerMonth: number | null;
  features: {
    ghostWorkDetection: boolean;
    decisionDrift: boolean;
    githubIntegration: boolean;
    advancedAnalytics: boolean;
    multiProject: boolean;
    prioritySupport: boolean;
  };
  trialDays?: number;
}

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  TRIAL: {
    tier: 'TRIAL',
    name: 'Free Trial',
    priceMonthlyUsd: 0,
    maxChannels: 3,
    maxAnalysesPerMonth: 30,
    trialDays: 14,
    features: {
      ghostWorkDetection: false,
      decisionDrift: false,
      githubIntegration: false,
      advancedAnalytics: false,
      multiProject: false,
      prioritySupport: false,
    },
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    priceMonthlyUsd: 29,
    stripePriceEnvVar: 'STRIPE_PRICE_PRO_MONTHLY',
    maxChannels: 15,
    maxAnalysesPerMonth: 500, // "unlimited within reasonable fair-use limits"
    features: {
      ghostWorkDetection: true,
      decisionDrift: true,
      githubIntegration: true,
      advancedAnalytics: false,
      multiProject: false,
      prioritySupport: false,
    },
  },
  BUSINESS: {
    tier: 'BUSINESS',
    name: 'Business',
    priceMonthlyUsd: 99,
    stripePriceEnvVar: 'STRIPE_PRICE_BUSINESS_MONTHLY',
    maxChannels: null,
    maxAnalysesPerMonth: 2000,
    features: {
      ghostWorkDetection: true,
      decisionDrift: true,
      githubIntegration: true,
      advancedAnalytics: true,
      multiProject: true,
      prioritySupport: true,
    },
  },
};

export function getPlanDefinition(tier: PlanTier): PlanDefinition {
  return PLAN_DEFINITIONS[tier];
}

export function getStripePriceId(tier: 'PRO' | 'BUSINESS'): string {
  const envVar = PLAN_DEFINITIONS[tier].stripePriceEnvVar!;
  const priceId = process.env[envVar];
  if (!priceId) throw new Error(`Missing env var ${envVar} for Stripe price id`);
  return priceId;
}
