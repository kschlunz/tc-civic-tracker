/** The real `Llm`: one streamed, schema-constrained Claude request per task. */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Llm } from "./extraction";

export const DEFAULT_MODEL = "claude-opus-5-5";

export function resolveModel(): string {
  return process.env.TRACKER_MODEL?.trim() || DEFAULT_MODEL;
}

/** Models that can hand a declined request to another model inside the same call. */
function supportsFallbacks(model: string): boolean {
  return /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model);
}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export interface Usage {
  requests: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/**
 * Build an `Llm` backed by the Claude API. The PDF goes first and is cached,
 * so the review and revise passes over the same minutes reuse it.
 */
export function createClaudeLlm(options: { model?: string; client?: Anthropic; log?: (line: string) => void } = {}): { llm: Llm; usage: Usage; model: string } {
  const model = options.model ?? resolveModel();
  const client = options.client ?? new Anthropic({ maxRetries: 4 });
  const log = options.log ?? ((line: string) => console.log(line));
  const usage: Usage = { requests: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
  const fallbacks = supportsFallbacks(model);

  const llm: Llm = async (request) => {
    const started = Date.now();
    const message = await client.beta.messages
      .stream({
        model,
        max_tokens: 64000,
        betas: fallbacks ? ["server-side-fallback-2026-07-01"] : [],
        ...(fallbacks ? { fallbacks: "default" as const } : {}),
        system: request.system,
        output_config: { effort: "high", format: betaZodOutputFormat(request.schema) },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: request.pdf.toString("base64") },
                cache_control: { type: "ephemeral" },
              },
              { type: "text", text: request.instructions },
            ],
          },
        ],
      })
      .finalMessage();

    usage.requests += 1;
    usage.inputTokens += message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0);
    usage.cachedInputTokens += message.usage.cache_read_input_tokens ?? 0;
    usage.outputTokens += message.usage.output_tokens;
    log(`    ${request.task}: ${Math.round((Date.now() - started) / 1000)}s, ${message.usage.output_tokens} output tokens${message.model !== model ? `, served by ${message.model}` : ""}`);

    if (message.stop_reason === "refusal") throw new Error(`The model declined the "${request.task}" request.`);
    if (message.stop_reason === "max_tokens") throw new Error(`The "${request.task}" response was cut off at the output limit.`);

    let json: unknown;
    try {
      json = JSON.parse(textOf(message));
    } catch {
      throw new Error(`The "${request.task}" response was not valid JSON.`);
    }
    return request.schema.parse(json);
  };

  return { llm, usage, model };
}
