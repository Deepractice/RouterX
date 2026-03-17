import { setWorldConstructor, World } from "@deepracticex/bdd";
import type { CanonicalRequest } from "../../packages/core/src/canonical/types";
import { AnthropicProtocolAdapter } from "../../packages/core/src/protocol/anthropic";
import { OpenAIProtocolAdapter } from "../../packages/core/src/protocol/openai";
import type { ProtocolAdapter } from "../../packages/core/src/protocol/types";

export class RouterXWorld extends World {
  // Protocol adapters
  openaiAdapter = new OpenAIProtocolAdapter();
  anthropicAdapter = new AnthropicProtocolAdapter();

  // Protocol test state
  requestBody?: unknown;
  canonicalRequest?: CanonicalRequest;
  formattedResponse?: unknown;
  formattedStreamChunk?: string;
  formattedError?: unknown;
  activeAdapter?: ProtocolAdapter;

  // Server / HTTP test state
  app?: any;
  httpResponse?: Response;
  httpResponseBody?: any;

  // Cross-protocol state
  capturedRequest?: CanonicalRequest | null;
}

setWorldConstructor(RouterXWorld);
