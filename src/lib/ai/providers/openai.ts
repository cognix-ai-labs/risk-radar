import type { AIProvider, AnalyzableMessage, AnalysisResult, RiskContextForQA } from '../types';
import { analysisResultSchema } from '../schema';
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt, buildQAPrompt } from '../prompt';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gpt-4o-mini'
  ) {}

  private async chat(system: string, user: string): Promise<string> {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenAI response missing message content');
    }
    return content;
  }

  async analyzeMessages(messages: AnalyzableMessage[]): Promise<AnalysisResult> {
    if (messages.length === 0) return { summary: 'No messages to analyze.', findings: [] };

    const raw = await this.chat(buildAnalysisSystemPrompt(), buildAnalysisUserPrompt(messages));

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('OpenAI returned malformed JSON');
    }

    const validated = analysisResultSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`OpenAI output failed schema validation: ${validated.error.message}`);
    }

    return validated.data as AnalysisResult;
  }

  async answerAboutRisks(question: string, context: RiskContextForQA): Promise<string> {
    const { system, user } = buildQAPrompt(question, context);
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI request failed (${res.status})`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "I couldn't generate an answer right now.";
  }
}
