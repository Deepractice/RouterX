/**
 * Canonical Types — the internal normalized format
 *
 * All protocols convert to/from this format.
 * This is the pivot point of the entire routing system.
 */

export interface CanonicalMessage {
  role: "system" | "user" | "assistant";
  content: string | CanonicalContentBlock[];
}

export interface CanonicalContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  [key: string]: unknown;
}

export interface CanonicalTool {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface CanonicalRequest {
  model: string;
  messages: CanonicalMessage[];
  tools?: CanonicalTool[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  stopSequences?: string[];
}

export type StopReason = "end_turn" | "max_tokens" | "tool_use" | "stop_sequence" | "error";

export interface CanonicalResponse {
  id: string;
  model: string;
  content: CanonicalContentBlock[];
  stopReason: StopReason;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface CanonicalStreamChunk {
  type:
    | "message_start"
    | "content_delta"
    | "tool_call_delta"
    | "message_stop"
    | "usage"
    | "error";
  data: unknown;
}
