import { describe, it, expect } from 'vitest';
import { analysisResultSchema, riskFindingSchema } from '@/lib/ai/schema';

describe('riskFindingSchema', () => {
  const validFinding = {
    type: 'blocker',
    severity: 'High',
    confidence: 0.8,
    project: 'Payment Launch',
    title: 'API is blocked',
    description: 'The payment API integration is blocked, based on explicit statements in the channel.',
    evidence: [{ messageId: 'msg_1', quote: 'The payment API is still not ready.' }],
    affectedPeople: ['Priya'],
    affectedDeadline: 'Payment Launch',
    recommendedActions: ['Assign API blocker'],
  };

  it('accepts a well-formed finding', () => {
    expect(riskFindingSchema.safeParse(validFinding).success).toBe(true);
  });

  it('rejects an invalid risk type', () => {
    const result = riskFindingSchema.safeParse({ ...validFinding, type: 'made_up_type' });
    expect(result.success).toBe(false);
  });

  it('rejects confidence outside 0..1', () => {
    expect(riskFindingSchema.safeParse({ ...validFinding, confidence: 1.5 }).success).toBe(false);
    expect(riskFindingSchema.safeParse({ ...validFinding, confidence: -0.1 }).success).toBe(false);
  });

  it('rejects a finding with zero evidence entries', () => {
    expect(riskFindingSchema.safeParse({ ...validFinding, evidence: [] }).success).toBe(false);
  });

  it('rejects a finding with zero recommended actions', () => {
    expect(riskFindingSchema.safeParse({ ...validFinding, recommendedActions: [] }).success).toBe(false);
  });
});

describe('analysisResultSchema', () => {
  it('defaults findings to an empty array when the AI returns malformed/missing findings', () => {
    const result = analysisResultSchema.safeParse({ summary: 'nothing found' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.findings).toEqual([]);
  });

  it('rejects entirely malformed JSON shapes gracefully (no throw, just success:false)', () => {
    expect(() => analysisResultSchema.safeParse('not even an object')).not.toThrow();
    expect(analysisResultSchema.safeParse('not even an object').success).toBe(false);
    expect(analysisResultSchema.safeParse(null).success).toBe(false);
    expect(analysisResultSchema.safeParse(42).success).toBe(false);
  });
});
