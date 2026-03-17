/**
 * Provider Adapter — upstream, LLM-facing
 *
 * Sends requests to LLM providers and returns responses.
 * Each provider (Anthropic, OpenAI, etc.) has its own adapter.
 */

import type { CanonicalRequest, CanonicalResponse, CanonicalStreamChunk } from "../canonical/types";

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface ProviderAdapter {
  readonly name: string;
  readonly protocol: string;

  /** Send request and get complete response */
  complete(request: CanonicalRequest, config: ProviderConfig): Promise<CanonicalResponse>;

  /** Send request and get streaming response */
  stream(request: CanonicalRequest, config: ProviderConfig): AsyncIterable<CanonicalStreamChunk>;
}
