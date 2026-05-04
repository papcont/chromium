/**
 * Cloud AI Provider — Fallback & Vision
 *
 * Used when:
 *   - Local models are not available / not loaded yet
 *   - Vision tasks (image-to-CAD in CADAM)
 *   - Complex reasoning beyond local model capability
 *
 * API keys are stored in the browser credential store — never in .env files.
 * Accessed via chrome.storage.session (cleared on browser close).
 */

import type { AIRequest, AIResponse } from '../nexus-ai-service';

interface StoredCredentials {
  claudeKey?: string;
  geminiKey?: string;
}

export class CloudProvider {
  private async getCredentials(): Promise<StoredCredentials> {
    return new Promise((resolve) => {
      // chrome.storage.session: encrypted, cleared on browser close
      chrome.storage.session.get(['claudeKey', 'geminiKey'], resolve);
    });
  }

  async generate(req: AIRequest, t0: number): Promise<AIResponse> {
    const creds = await this.getCredentials();

    // Prefer Claude for code gen, Gemini for everything else
    if (creds.claudeKey && (req.context === 'cad-code' || req.context === 'cad-fast')) {
      return this.claudeGenerate(req, creds.claudeKey, t0);
    }
    if (creds.geminiKey) {
      return this.geminiGenerate(req, creds.geminiKey, t0);
    }
    if (creds.claudeKey) {
      return this.claudeGenerate(req, creds.claudeKey, t0);
    }

    throw new Error(
      'No AI provider available. Add API keys in Nexus settings or ensure ' +
      'Chrome Built-in AI is enabled on this device.'
    );
  }

  private async claudeGenerate(
    req: AIRequest,
    apiKey: string,
    t0: number
  ): Promise<AIResponse> {
    const body: Record<string, unknown> = {
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [{ role: 'user', content: req.prompt }],
    };
    if (req.systemPrompt) body.system = req.systemPrompt;
    if (req.image) {
      body.messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: req.image } },
          { type: 'text', text: req.prompt },
        ],
      }];
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return {
      text: data.content?.[0]?.text ?? '',
      provider: 'cloud',
      model: 'claude-opus-4-7',
      latencyMs: performance.now() - t0,
    };
  }

  private async geminiGenerate(
    req: AIRequest,
    apiKey: string,
    t0: number
  ): Promise<AIResponse> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: req.prompt }] }],
        }),
      }
    );
    const data = await res.json();
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      provider: 'cloud',
      model: 'gemini-2.0-flash',
      latencyMs: performance.now() - t0,
    };
  }
}
