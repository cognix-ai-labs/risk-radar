'use client';

import { useFetch } from './useFetch';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  slackConnected: boolean;
  plan: 'TRIAL' | 'PRO' | 'BUSINESS';
  subscriptionStatus: string;
}

/** MVP simplification: a user's first workspace membership is treated as
 *  "current." A workspace switcher for users in multiple workspaces
 *  (Business plan multi-team) is a natural follow-up, not required for the
 *  core single-tenant flow this MVP targets. */
export function useCurrentWorkspace(): { workspace: WorkspaceSummary | null; loading: boolean; error: string | null; refetch: () => void } {
  const { data, loading, error, refetch } = useFetch<{ workspaces: WorkspaceSummary[] }>('/api/workspaces');
  return { workspace: data?.workspaces[0] ?? null, loading, error, refetch };
}
