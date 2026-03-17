/**
 * Anthropic Messages Protocol Adapter
 *
 * Handles parsing Anthropic format requests and formatting responses.
 * Endpoint: POST /v1/messages
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
// Anthropic Request Types (input)
// ============================================================================

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
  [key: string]: unknown;
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicMessagesRequest {
  model: string;
  max_tokens: number;
  system?: string | AnthropicContentBlock[];
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop_sequences?: string[];
}

// ============================================================================
// Anthropic Response Types (output)
// ============================================================================

interface AnthropicMessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicResponseContentBlock[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicResponseContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

// ============================================================================
// Mapping helpers
// ============================================================================

function mapErrorType(status: number): string {
  switch (status) {
    case 401:
      return "authentication_error";
    case 403:
      return "permission_error";
    case 404:
      return "not_found_error";
    case 429:
      return "rate_limit_exceeded";
    case 500:
      return "api_error";
    default:
      return "api_error";
  }
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class AnthropicProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "anthropic";

  parseRequest(body: unknown): CanonicalRequest {
    const req = body as AnthropicMessagesRequest;

    const messages: CanonicalMessage[] = [];

    // Anthropic has system as a top-level field, normalize to a system message
    if (req.system) {
      const systemContent =
        typeof req.system === "string"
          ? req.system
          : req.system
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("\n");
      messages.push({ role: "system", content: systemContent });
    }

    for (const msg of req.messages) {
      messages.push({
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      });
    }

    const tools: CanonicalTool[] | undefined = req.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }));

    return {
      model: req.model,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      maxTokens: req.max_tokens,
      temperature: req.temperature,
      topP: req.top_p,
      stream: req.stream,
      stopSequences: req.stop_sequences,
    };
  }

  formatResponse(response: CanonicalResponse): AnthropicMessagesResponse {
    const content: AnthropicResponseContentBlock[] = response.content.map((c) => {
      if (c.type === "text") {
        return { type: "text" as const, text: c.text as string };
      }
      if (c.type === "tool_use") {
        return {
          type: "tool_use" as const,
          id: c.id as string,
          name: c.name as string,
          input: (c.input as Record<string, unknown>) ?? {},
        };
      }
      return { type: "text" as const, text: "" };
    });

    return {
      id: response.id,
      type: "message",
      role: "assistant",
      model: response.model,
      content,
      stop_reason: response.stopReason,
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
      },
    };
  }

  formatStreamChunk(chunk: CanonicalStreamChunk): string {
    switch (chunk.type) {
      case "message_start": {
        const d = chunk.data as { id: string; model: string };
        return `event: message_start\ndata: ${JSON.stringify({
          type: "message_start",
          message: {
            id: d.id,
            type: "message",
            role: "assistant",
            model: d.model,
            content: [],
          },
        })}\n\n`;
      }
      case "content_delta": {
        const d = chunk.data as { text: string };
        return `event: content_block_delta\ndata: ${JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: d.text },
        })}\n\n`;
      }
      case "message_stop": {
        const d = chunk.data as { stopReason: StopReason };
        return `event: message_delta\ndata: ${JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: d.stopReason },
        })}\n\nevent: message_stop\ndata: ${JSON.stringify({
          type: "message_stop",
        })}\n\n`;
      }
      case "usage": {
        const d = chunk.data as { inputTokens: number; outputTokens: number };
        return `event: message_delta\ndata: ${JSON.stringify({
          type: "message_delta",
          usage: {
            input_tokens: d.inputTokens,
            output_tokens: d.outputTokens,
          },
        })}\n\n`;
      }
      default:
        return "";
    }
  }

  formatError(
    status: number,
    message: string
  ): { type: "error"; error: { type: string; message: string } } {
    return {
      type: "error",
      error: {
        type: mapErrorType(status),
        message,
      },
    };
  }
}
