import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAIProvider, resetAIProviderCache, enforceEvidenceGrounding } from '@/lib/ai/provider';
import { MockAIProvider } from '@/lib/ai/providers/mock';
import type { AnalyzableMessage, AnalysisResult } from '@/lib/ai/types';

describe('getAIProvider', () => {
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    resetAIProviderCache();
    delete process.env.DEMO_MODE;
    delete process.env.AI_PROVIDER;
    // These tests assert behavior for the "no key configured" case
    // specifically, regardless of what this machine's real shell env has.
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it('returns the mock provider when DEMO_MODE is true, regardless of AI_PROVIDER', () => {
    process.env.DEMO_MODE = 'true';
    process.env.AI_PROVIDER = 'openai';
    expect(getAIProvider()).toBeInstanceOf(MockAIProvider);
  });

  it('defaults to the mock provider when AI_PROVIDER is unset', () => {
    expect(getAIProvider().name).toBe('mock');
  });

  it('throws when AI_PROVIDER=openai is set without an API key', () => {
    process.env.AI_PROVIDER = 'openai';
    expect(() => getAIProvider()).toThrow(/OPENAI_API_KEY/);
  });

  it('throws on an unknown provider name', () => {
    process.env.AI_PROVIDER = 'not-a-real-provider';
    expect(() => getAIProvider()).toThrow(/Unknown AI_PROVIDER/);
  });
});

describe('enforceEvidenceGrounding', () => {
  const messages: AnalyzableMessage[] = [
    {
      messageId: 'real-1',
      channelName: 'payment-launch',
      userDisplayName: 'Priya',
      text: 'The payment API is still not ready.',
      postedAt: new Date().toISOString(),
    },
  ];

  it('keeps a finding whose evidence quote genuinely appears in the cited message', () => {
    const result: AnalysisResult = {
      summary: 's',
      findings: [
        {
          type: 'blocker',
          severity: 'High',
          confidence: 0.8,
          project: null,
          title: 't',
          description: 'd',
          evidence: [{ messageId: 'real-1', quote: 'The payment API is still not ready.' }],
          affectedPeople: [],
          affectedDeadline: null,
          recommendedActions: ['a'],
        },
      ],
    };

    const grounded = enforceEvidenceGrounding(result, messages);
    expect(grounded.findings).toHaveLength(1);
  });

  it('drops evidence citing a messageId that was never in the input batch (fabricated evidence)', () => {
    const result: AnalysisResult = {
      summary: 's',
      findings: [
        {
          type: 'blocker',
          severity: 'High',
          confidence: 0.9,
          project: null,
          title: 'Fabricated risk',
          description: 'd',
          evidence: [{ messageId: 'does-not-exist', quote: 'Something the AI made up.' }],
          affectedPeople: [],
          affectedDeadline: null,
          recommendedActions: ['a'],
        },
      ],
    };

    const grounded = enforceEvidenceGrounding(result, messages);
    expect(grounded.findings).toHaveLength(0);
  });

  it('drops evidence whose quote does not actually appear in the cited real message', () => {
    const result: AnalysisResult = {
      summary: 's',
      findings: [
        {
          type: 'blocker',
          severity: 'High',
          confidence: 0.9,
          project: null,
          title: 'Misquoted risk',
          description: 'd',
          evidence: [{ messageId: 'real-1', quote: 'This exact phrase was never said by anyone.' }],
          affectedPeople: [],
          affectedDeadline: null,
          recommendedActions: ['a'],
        },
      ],
    };

    const grounded = enforceEvidenceGrounding(result, messages);
    expect(grounded.findings).toHaveLength(0);
  });
});

describe('MockAIProvider', () => {
  it('detects a blocker + dependency + deadline_risk from the product spec example conversation', async () => {
    const provider = new MockAIProvider();
    const messages: AnalyzableMessage[] = [
      { messageId: '1', channelName: 'payment-launch', userDisplayName: 'Priya', text: 'The payment API is still not ready.', postedAt: new Date().toISOString() },
      { messageId: '2', channelName: 'payment-launch', userDisplayName: 'Marcus', text: "QA can't test because staging is broken.", postedAt: new Date().toISOString() },
      { messageId: '3', channelName: 'payment-launch', userDisplayName: 'Dana', text: 'Waiting for design approval.', postedAt: new Date().toISOString() },
      { messageId: '4', channelName: 'payment-launch', userDisplayName: 'Priya', text: 'Can we move the launch?', postedAt: new Date().toISOString() },
    ];

    const result = await provider.analyzeMessages(messages);
    const types = result.findings.map((f) => f.type);

    expect(types).toContain('blocker');
    expect(types).toContain('dependency');
    expect(types).toContain('deadline_risk');

    // Every finding must cite evidence that traces back to a real messageId.
    const validIds = new Set(messages.map((m) => m.messageId));
    for (const finding of result.findings) {
      expect(finding.evidence.length).toBeGreaterThan(0);
      for (const e of finding.evidence) expect(validIds.has(e.messageId)).toBe(true);
    }
  });

  it('detects ghost_work only when both "no ticket" and effort signals are present', async () => {
    const provider = new MockAIProvider();
    const messages: AnalyzableMessage[] = [
      { messageId: '1', channelName: 'backend-eng', userDisplayName: 'Rahul', text: 'Still debugging the payment API.', postedAt: new Date().toISOString() },
      { messageId: '2', channelName: 'backend-eng', userDisplayName: 'Rahul', text: 'No ticket exists for this.', postedAt: new Date().toISOString() },
    ];

    const result = await provider.analyzeMessages(messages);
    expect(result.findings.some((f) => f.type === 'ghost_work')).toBe(true);
  });

  it('returns no findings for entirely benign conversation', async () => {
    const provider = new MockAIProvider();
    const messages: AnalyzableMessage[] = [
      { messageId: '1', channelName: 'random', userDisplayName: 'Priya', text: 'Happy Friday everyone!', postedAt: new Date().toISOString() },
    ];
    const result = await provider.analyzeMessages(messages);
    expect(result.findings).toHaveLength(0);
  });
});
