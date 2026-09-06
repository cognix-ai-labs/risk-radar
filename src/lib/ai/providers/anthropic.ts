import type { AIProvider, AnalyzableMessage, AnalysisResult, RiskContextForQA } from '../types';
import { analysisResultSchema } from '../schema';
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt, buildQAPrompt } from '../prompt';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'claude-sonnet-5'
  ) {}

  private async complete(system: string, user: string, maxTokens = 2000): Promise<string> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature: 0.1,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== 'string') throw new Error('Anthropic response missing content text');
    return text;
  }

  async analyzeMessages(messages: AnalyzableMessage[]): Promise<AnalysisResult> {
    if (messages.length === 0) return { summary: 'No messages to analyze.', findings: [] };

    const raw = await this.complete(
      buildAnalysisSystemPrompt() + '\n\nRespond with ONLY the JSON object, no other text.',
      buildAnalysisUserPrompt(messages),
      4000
    );

    const jsonText = extractJson(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('Anthropic returned malformed JSON');
    }

    const validated = analysisResultSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Anthropic output failed schema validation: ${validated.error.message}`);
    }

    return validated.data as AnalysisResult;
  }

  async answerAboutRisks(question: string, context: RiskContextForQA): Promise<string> {
    const { system, user } = buildQAPrompt(question, context);
    return this.complete(system, user, 800);
  }
}

/** Strips accidental markdown code fences some models add despite instructions. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}
