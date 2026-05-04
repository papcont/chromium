/**
 * Chrome Built-in AI Provider
 *
 * Wraps the Chrome Prompt API (window.ai.languageModel) and
 * Summarizer API (window.ai.summarizer) — Gemini Nano, zero latency.
 *
 * Enabled in Nexus builds via:
 *   chrome://flags/#optimization-guide-on-device-model  (auto-enabled in Nexus)
 */

import type { AIRequest, AIResponse } from '../nexus-ai-service';

type BuiltInCapability = 'language-model' | 'summarizer' | 'translator';

const CAD_SYSTEM_PROMPT = `You are an OpenSCAD expert. Generate valid, parametric OpenSCAD code.
Always use variables for dimensions. Add brief comments. Output only code, no explanation.`;

const PLM_SYSTEM_PROMPT = `You are a PLM data analyst. Extract and summarize product lifecycle
management data concisely. Focus on key attributes, status, and relationships.`;

export class BuiltInAIProvider {
  private languageSession: unknown = null;
  private summarizerSession: unknown = null;

  async isAvailable(capability: BuiltInCapability): Promise<boolean> {
    try {
      // @ts-expect-error Chrome AI APIs not yet in TypeScript lib
      const ai = window.ai;
      if (!ai) return false;

      if (capability === 'language-model') {
        const caps = await ai.languageModel?.capabilities();
        return caps?.available === 'readily' || caps?.available === 'after-download';
      }
      if (capability === 'summarizer') {
        const caps = await ai.summarizer?.capabilities();
        return caps?.available === 'readily' || caps?.available === 'after-download';
      }
      return false;
    } catch {
      return false;
    }
  }

  async warm(): Promise<void> {
    try {
      // @ts-expect-error
      const ai = window.ai;
      if (!ai) return;
      this.languageSession = await ai.languageModel?.create({
        systemPrompt: CAD_SYSTEM_PROMPT,
      });
    } catch {
      // Built-in AI not available on this device
    }
  }

  async generate(req: AIRequest, t0: number): Promise<AIResponse> {
    // @ts-expect-error
    const ai = window.ai;
    const systemPrompt =
      req.systemPrompt ??
      (req.context?.startsWith('cad') ? CAD_SYSTEM_PROMPT : PLM_SYSTEM_PROMPT);

    const session =
      (this.languageSession as any) ??
      (await ai.languageModel.create({ systemPrompt }));

    const text = await (session as any).prompt(req.prompt);
    return {
      text,
      provider: 'built-in',
      model: 'gemini-nano',
      latencyMs: performance.now() - t0,
    };
  }

  async summarize(req: AIRequest, t0: number): Promise<AIResponse> {
    // @ts-expect-error
    const ai = window.ai;
    const summarizer =
      (this.summarizerSession as any) ??
      (await ai.summarizer.create({ type: 'key-points', length: 'short' }));

    const text = await (summarizer as any).summarize(req.prompt);
    return {
      text,
      provider: 'built-in',
      model: 'gemini-nano-summarizer',
      latencyMs: performance.now() - t0,
    };
  }
}
