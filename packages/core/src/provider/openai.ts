/**
 * OpenAI-Compatible Provider Adapter
 *
 * Sends requests to any OpenAI-compatible API (OpenAI, Deepseek, Volcengine Ark, etc.)
 * Converts CanonicalRequest → OpenAI format, sends HTTP request, converts response back.
 */

import type {
  CanonicalContentBlock,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalStreamChunk,
  StopReason,
} from "../canonical/types";
import type { ProviderAdapter, ProviderConfig } from "./types";

// ============================================================================
// OpenAI API types (upstream)
// ============================================================================

interface OpenAIRequestBody {
  model: string;
  messages: Array<{ role: string; content: string | null }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string[];
  tools?: Array<{
    type: "function";
    function: { name: string; description?: string; parameters: Record<string, unknown> };
  }>;
}

function mapFinishReason(reason: string | null): StopReason {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    case "tool_calls":
      return "tool_use";
    default:
      return "end_turn";
  }
}

// ============================================================================
// Adapter
// ============================================================================

export class OpenAIProviderAdapter implements ProviderAdapter {
  readonly name = "openai-compatible";
  readonly protocol = "openai";

  private buildRequestBody(request: CanonicalRequest): OpenAIRequestBody {
    const body: OpenAIRequestBody = {
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    };

    if (request.maxTokens != null) body.max_tokens = request.maxTokens;
    if (request.temperature != null) body.temperature = request.temperature;
    if (request.topP != null) body.top_p = request.topP;
    if (request.stream != null) body.stream = request.stream;
    if (request.stopSequences) body.stop = request.stopSequences;

    if (request.tools?.length) {
      body.tools = request.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    return body;
  }

  async complete(request: CanonicalRequest, config: ProviderConfig): Promise<CanonicalResponse> {
    const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    const body = this.buildRequestBody({ ...request, stream: false });

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Provider returned ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    const choice = data.choices?.[0];

    const content: CanonicalContentBlock[] = [];
    if (choice?.message?.content) {
      content.push({ type: "text", text: choice.message.content });
    }
    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}"),
        });
      }
    }

    return {
      id: data.id ?? "unknown",
      model: data.model ?? request.model,
      content,
      stopReason: mapFinishReason(choice?.finish_reason),
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *stream(
    request: CanonicalRequest,
    config: ProviderConfig
  ): AsyncIterable<CanonicalStreamChunk> {
    const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    const body = this.buildRequestBody({ ...request, stream: true });

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Provider returned ${res.status}: ${errText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let started = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") return;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta;
          const finishReason = chunk.choices?.[0]?.finish_reason;

          if (!started) {
            yield {
              type: "message_start",
              data: { id: chunk.id ?? "unknown", model: chunk.model ?? request.model },
            };
            started = true;
          }

          if (delta?.content) {
            yield { type: "content_delta", data: { text: delta.content } };
          }

          if (finishReason) {
            yield {
              type: "message_stop",
              data: { stopReason: mapFinishReason(finishReason) },
            };
          }

          if (chunk.usage) {
            yield {
              type: "usage",
              data: {
                inputTokens: chunk.usage.prompt_tokens ?? 0,
                outputTokens: chunk.usage.completion_tokens ?? 0,
              },
            };
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}
