/**
 * Transformers.js Provider (@huggingface/transformers)
 *
 * WASM + WebGPU backend for small, specialized models.
 * Does NOT require GPU — works on any device.
 *
 * Use cases for Nexus:
 *   - Semantic embeddings for PLM item search (~30MB model)
 *   - Named entity recognition in PLM descriptions
 *   - Part number / material classification
 */

import type { AIRequest, AIResponse } from '../nexus-ai-service';

const EMBEDDER_MODEL = 'Xenova/all-MiniLM-L6-v2'; // 30MB, 384-dim embeddings

export class TransformersProvider {
  private embedder: unknown = null;

  async warmEmbedder(): Promise<void> {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Cache models in OPFS so they survive browser restarts
      env.cacheDir = '/opfs/nexus/models/';
      this.embedder = await pipeline('feature-extraction', EMBEDDER_MODEL, {
        device: 'webgpu', // Falls back to WASM automatically
      });
    } catch {
      // Transformers.js failed to load — non-fatal
    }
  }

  async embed(req: AIRequest, t0: number): Promise<AIResponse> {
    if (!this.embedder) await this.warmEmbedder();
    if (!this.embedder) throw new Error('Embedder not available');

    const output = await (this.embedder as any)(req.prompt, {
      pooling: 'mean',
      normalize: true,
    });

    // Return embeddings as JSON string so the caller can parse
    return {
      text: JSON.stringify(Array.from(output.data as Float32Array)),
      provider: 'transformers',
      model: EMBEDDER_MODEL,
      latencyMs: performance.now() - t0,
    };
  }

  /**
   * Find the most semantically similar PLM items to a query.
   * Items and their cached embeddings are stored in Nexus local DB.
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] ** 2;
      magB += b[i] ** 2;
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}
