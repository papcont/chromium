/**
 * Nexus AI Service
 *
 * Layered AI inference router:
 *   1. Chrome Built-in AI (Gemini Nano)  — zero latency, offline, no download
 *   2. WebLLM (@mlc-ai/web-llm)          — GPU-accelerated, models in OPFS
 *   3. Transformers.js                   — WASM, embeddings & small tasks
 *   4. Cloud (Claude / Gemini API)       — fallback for vision & complex tasks
 */

export type AIContext =
  | 'cad-fast'       // Simple shape descriptions → OpenSCAD snippets
  | 'cad-code'       // Complex parametric code generation
  | 'plm-summarize'  // Summarize PLM item descriptions
  | 'plm-extract'    // Extract structured data from PLM text
  | 'embed'          // Generate embeddings for semantic search
  | 'vision'         // Image-to-CAD (requires cloud)
  | 'general';

export interface AIRequest {
  prompt: string;
  context: AIContext;
  systemPrompt?: string;
  stream?: boolean;
  image?: string; // base64, vision tasks only
}

export interface AIResponse {
  text: string;
  provider: 'built-in' | 'webllm' | 'transformers' | 'cloud';
  model: string;
  latencyMs: number;
}

import { BuiltInAIProvider } from './providers/built-in-ai';
import { WebLLMProvider } from './providers/webllm-provider';
import { TransformersProvider } from './providers/transformers-provider';
import { CloudProvider } from './providers/cloud-provider';

const builtIn = new BuiltInAIProvider();
const webllm = new WebLLMProvider();
const transformers = new TransformersProvider();
const cloud = new CloudProvider();

/**
 * Route a request to the best available local provider,
 * falling back toward cloud as needed.
 */
export async function nexusGenerate(req: AIRequest): Promise<AIResponse> {
  const t0 = performance.now();

  // Vision always needs cloud (multimodal)
  if (req.context === 'vision' || req.image) {
    return cloud.generate(req, t0);
  }

  // Embeddings always use Transformers.js (small, fast, local)
  if (req.context === 'embed') {
    return transformers.embed(req, t0);
  }

  // PLM summarization: Built-in AI Summarizer API is perfect
  if (req.context === 'plm-summarize' || req.context === 'plm-extract') {
    const available = await builtIn.isAvailable('summarizer');
    if (available) return builtIn.summarize(req, t0);
    return cloud.generate(req, t0);
  }

  // CAD fast: Built-in AI (Gemini Nano) → cloud fallback
  if (req.context === 'cad-fast' || req.context === 'general') {
    const available = await builtIn.isAvailable('language-model');
    if (available) return builtIn.generate(req, t0);
    return cloud.generate(req, t0);
  }

  // CAD code gen: WebLLM (Phi-3/CodeLlama) → Built-in → cloud
  if (req.context === 'cad-code') {
    try {
      const ready = await webllm.isReady();
      if (ready) return webllm.generate(req, t0);
    } catch {
      // WebLLM not loaded yet — fall through
    }
    const builtInAvail = await builtIn.isAvailable('language-model');
    if (builtInAvail) return builtIn.generate(req, t0);
    return cloud.generate(req, t0);
  }

  return cloud.generate(req, t0);
}

/**
 * Pre-warm providers in priority order.
 * Called once at browser startup for fast first-inference.
 */
export async function warmProviders(): Promise<void> {
  await Promise.allSettled([
    builtIn.warm(),
    transformers.warmEmbedder(),
  ]);
}

/**
 * Download the WebLLM engineering model to OPFS.
 * Called lazily on first cad-code request or proactively from settings.
 */
export async function downloadEngineeringModel(
  onProgress?: (progress: number) => void
): Promise<void> {
  await webllm.downloadModel(
    'Phi-3.5-mini-instruct-q4f16_1-MLC',
    onProgress
  );
}
