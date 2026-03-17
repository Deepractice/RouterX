/**
 * OpenAI Chat Completions Protocol Adapter
 *
 * Handles parsing OpenAI format requests and formatting responses.
 * Endpoint: POST /v1/chat/completions
 */

import type {
  CanonicalMessage,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalStreamChunk,
  CanonicalTool,
  StopReason,
} from "../canonical/types";
import type { ProtocolAdapter } from "./types";

// ============================================================================
// OpenAI Request Types (input)
// ============================================================================

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

// ============================================================================
// OpenAI Response Types (output)
// ============================================================================

interface OpenAIChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string;
}

// ============================================================================
// Mapping helpers
// ============================================================================

function mapStopReason(reason: StopReason): string {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    case "stop_sequence":
      return "stop";
    default:
      return "stop";
  }
}

function mapErrorType(status: number): string {
  switch (status) {
    case 401:
      return "authentication_error";
    case 403:
      return "permission_error";
    case 404:
      return "not_found_error";
    case 429:
      return "rate_limit_error";
    case 500:
      return "server_error";
    default:
      return "api_error";
  }
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class OpenAIProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "openai";

  parseRequest(body: unknown): CanonicalRequest {
    const req = body as OpenAIChatCompletionRequest;

    const messages: CanonicalMessage[] = req.messages.map((msg) => ({
      role: msg.role === "tool" ? "user" : (msg.role as CanonicalMessage["role"]),
      content: msg.content ?? "",
    }));

    const tools: CanonicalTool[] | undefined = req.tools?.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));

    const stopSequences =
      req.stop == null ? undefined : Array.isArray(req.stop) ? req.stop : [req.stop];

    return {
      model: req.model,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      maxTokens: req.max_tokens ?? req.max_completion_tokens,
      temperature: req.temperature,
      topP: req.top_p,
      stream: req.stream,
      stopSequences,
    };
  }

  formatResponse(response: CanonicalResponse): OpenAIChatCompletionResponse {
    const textContent = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text as string)
      .join("");

    const toolCalls = response.content
      .filter((c) => c.type === "tool_use")
      .map((c, i) => ({
        id: (c.id as string) ?? `call_${i}`,
        type: "function" as const,
        function: {
          name: c.name as string,
          arguments: JSON.stringify(c.input ?? {}),
        },
      }));

    const message: OpenAIChoice["message"] = {
      role: "assistant",
      content: textContent || null,
    };

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    return {
      id: response.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: mapStopReason(response.stopReason),
        },
      ],
      usage: {
        prompt_tokens: response.usage.inputTokens,
        completion_tokens: response.usage.outputTokens,
        total_tokens: response.usage.inputTokens + response.usage.outputTokens,
      },
    };
  }

  formatStreamChunk(chunk: CanonicalStreamChunk): string {
    let json: string;
    switch (chunk.type) {
      case "message_start": {
        const d = chunk.data as { id: string; model: string };
        json = JSON.stringify({
          id: d.id,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: d.model,
          choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        });
        break;
      }
      case "content_delta": {
        const d = chunk.data as { text: string };
        json = JSON.stringify({
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: { content: d.text }, finish_reason: null }],
        });
        break;
      }
      case "message_stop": {
        const d = chunk.data as { stopReason: StopReason };
        json = JSON.stringify({
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: {}, finish_reason: mapStopReason(d.stopReason) }],
        });
        break;
      }
      case "usage": {
        const d = chunk.data as { inputTokens: number; outputTokens: number };
        json = JSON.stringify({
          object: "chat.completion.chunk",
          usage: {
            prompt_tokens: d.inputTokens,
            completion_tokens: d.outputTokens,
            total_tokens: d.inputTokens + d.outputTokens,
          },
        });
        break;
      }
      default:
        return "";
    }
    return `data: ${json}\n\n`;
  }

  formatError(
    status: number,
    message: string
  ): { error: { message: string; type: string; code: number } } {
    return {
      error: {
        message,
        type: mapErrorType(status),
        code: status,
      },
    };
  }
}
