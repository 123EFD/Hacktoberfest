// evaluate venues and produce the best destination via open-weight model

import { pipeline, env } from "@huggingface/transformers";

// Enable WebGPU for fast on-device inference with safe fallback check
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 2;
}

export interface EateryCandidate {
  id: number | string;
  name: string;
  cuisine: string;
  outdoor_seating: boolean;
  lat: number;
  lon: number;
}

type TextGenerationFunction = (
  text: string,
  options?: { max_new_tokens?: number; temperature?: number }
) => Promise<Array<{ generated_text: string }>>;

let generator: TextGenerationFunction | null = null;

export async function initAI(): Promise<TextGenerationFunction> {
  if (!generator) {
    const pipe = await pipeline(
      "text-generation",
      "onnx-community/SmolLM2-360M-Instruct", // Lightweight SLM for instant on-device execution
      { device: "webgpu" }
    );
    generator = pipe as unknown as TextGenerationFunction;
  }
  return generator;
}

export async function pickBestEatery(candidates: EateryCandidate[]): Promise<string> {
  const ai = await initAI();
  const prompt = `
You are an expert street food guide. Analyze these candidates and pick the 1 place that offers high quality, lively atmosphere, and authentic food:
${JSON.stringify(candidates.slice(0, 5))}

Return valid JSON with keys: "chosen_id", "signature_dish", "verdict_reason".
JSON:`;

  const output = await ai(prompt, { max_new_tokens: 150, temperature: 0.2 });
  return output[0].generated_text;
}