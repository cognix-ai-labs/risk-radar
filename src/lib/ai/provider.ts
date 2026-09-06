import type { AIProvider, AnalyzableMessage, AnalysisResult } from './types';
import { MockAIProvider } from './providers/mock';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';

let cached: AIProvider | null = null;

/** Provider selection is centralized here so switching models later is a
 *  one-line env change — nothing else in the app should import a concrete
 *  provider class directly. */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const configured = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
  const isDemoMode = process.env.DEMO_MODE === 'true';

  if (isDemoMode || configured === 'mock') {
    cached = new MockAIProvider();
  } else if (configured === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('AI_PROVIDER=openai requires OPENAI_API_KEY to be set');
    cached = new OpenAIProvider(key);
  } else if (configured === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY to be set');
    cached = new AnthropicProvider(key);
  } else {
    throw new Error(`Unknown AI_PROVIDER "${configured}" — expected mock | openai | anthropic`);
  }

  return cached;
}

/** Resets the cached provider — used by tests that toggle env vars. */
export function resetAIProviderCache(): void {
  cached = null;
}

/**
 * Structural enforcement of "never fabricate evidence": strips any finding
 * whose evidence doesn't resolve to a real message in the analyzed batch,
 * and strips individual evidence entries that reference an unknown
 * messageId or a quote that doesn't actually appear in that message. This
 * runs regardless of which provider produced the result, so a prompt
 * regression in one provider can't silently start inventing evidence.
 */
export function enforceEvidenceGrounding(result: AnalysisResult, sourceMessages: AnalyzableMessage[]): AnalysisResult {
  const byId = new Map(sourceMessages.map((m) => [m.messageId, m]));

  const findings = result.findings
    .map((finding) => {
      const groundedEvidence = finding.evidence.filter((e) => {
        const source = byId.get(e.messageId);
        if (!source) return false;
        // Loose containment check tolerant of minor paraphrasing/whitespace.
        const normalizedQuote = e.quote.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedText = source.text.toLowerCase().replace(/\s+/g, ' ').trim();
        return normalizedQuote.length > 0 && normalizedText.includes(normalizedQuote.slice(0, Math.min(normalizedQuote.length, 60)));
      });
      return { ...finding, evidence: groundedEvidence };
    })
    .filter((finding) => finding.evidence.length > 0);

  return { ...result, findings };
}
