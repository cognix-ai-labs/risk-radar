import { z } from 'zod';

/** Strict schema every LLM provider's raw JSON output must pass before it is
 *  trusted. Anything that fails validation is discarded rather than
 *  "repaired" — a malformed AI response should never silently become a
 *  fabricated finding. See lib/risk-engine/analyze.ts for how failures are
 *  logged and surfaced. */
export const riskFindingSchema = z.object({
  type: z.enum([
    'blocker',
    'dependency',
    'deadline_risk',
    'ghost_work',
    'decision_drift',
    'customer_issue',
    'resource_risk',
  ]),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
  confidence: z.number().min(0).max(1),
  project: z.string().nullable(),
  title: z.string().min(3).max(160),
  description: z.string().min(10).max(2000),
  evidence: z
    .array(
      z.object({
        messageId: z.string(),
        quote: z.string().min(1).max(500),
      })
    )
    .min(1, 'Every finding must cite at least one real message as evidence'),
  affectedPeople: z.array(z.string()).default([]),
  affectedDeadline: z.string().nullable().default(null),
  recommendedActions: z.array(z.string()).min(1).max(6),
});

export const analysisResultSchema = z.object({
  summary: z.string().default(''),
  findings: z.array(riskFindingSchema).default([]),
});

export type ValidatedRiskFinding = z.infer<typeof riskFindingSchema>;
export type ValidatedAnalysisResult = z.infer<typeof analysisResultSchema>;
