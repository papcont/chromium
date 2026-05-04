/**
 * WebLLM Provider (@mlc-ai/web-llm)
 *
 * Runs quantized LLMs (Phi-3.5, Llama, Mistral) via WebGPU.
 * Models are downloaded once to OPFS and cached permanently.
 *
 * Best for: complex OpenSCAD code generation, multi-step CAD reasoning.
 * Requires: WebGPU-capable GPU (integrated or discrete).
 */

import type { AIRequest, AIResponse } from '../nexus-ai-service';

// Engineering-optimized model choices (ordered by size/capability trade-off)
const ENGINEERING_MODELS = [
  'Phi-3.5-mini-instruct-q4f16_1-MLC',  // 2.2GB — best quality/size ratio
  'Phi-3-mini-4k-instruct-q4f32_1-MLC', // 2.4GB — fallback
  'Llama-3.2-1B-Instruct-q4f32_1-MLC',  // 0.8GB — low VRAM devices
] as const;

const OPENSCAD_SYSTEM = `You are an expert OpenSCAD programmer for mechanical engineering.
Generate precise, parametric OpenSCAD code. Use variables for all dimensions.
Include the module definition and a demo instantiation. Output only valid OpenSCAD code.`;

export class WebLLMProvider {
  private engine: unknown = null;
  private loadedModel: string | null = null;

  async isReady(): Promise<boolean> {
    return this.engine !== null;
  }

  async downloadModel(
    modelId: string = ENGINEERING_MODELS[0],
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Dynamic import — only bundled when nexus_engineering_browser=true
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    this.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report: { progress: number }) => {
        onProgress?.(report.progress);
      },
    });
    this.loadedModel = modelId;
  }

  async generate(req: AIRequest, t0: number): Promise<AIResponse> {
    if (!this.engine) {
      throw new Error('WebLLM engine not initialized — call downloadModel() first');
    }

    const engine = this.engine as any;
    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: req.systemPrompt ?? OPENSCAD_SYSTEM },
        { role: 'user', content: req.prompt },
      ],
      temperature: 0.2, // Low temperature for deterministic code gen
      max_tokens: 1024,
      stream: false,
    });

    return {
      text: completion.choices[0].message.content ?? '',
      provider: 'webllm',
      model: this.loadedModel ?? 'unknown',
      latencyMs: performance.now() - t0,
    };
  }

  /** Estimate if GPU has enough VRAM for the model */
  static async detectBestModel(): Promise<string> {
    const adapter = await navigator.gpu?.requestAdapter();
    const info = await adapter?.requestAdapterInfo();
    // Check available GPU memory — conservative estimates
    const limits = (adapter as any)?.limits;
    const vramBytes = limits?.maxBufferSize ?? 0;
    if (vramBytes > 6 * 1024 ** 3) return ENGINEERING_MODELS[0]; // 6GB+
    if (vramBytes > 2 * 1024 ** 3) return ENGINEERING_MODELS[1]; // 2-6GB
    return ENGINEERING_MODELS[2];                                  // <2GB
  }
}
