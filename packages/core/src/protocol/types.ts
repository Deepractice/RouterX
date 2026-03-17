/**
 * Protocol Adapter — downstream, client-facing
 *
 * Parses incoming client requests and formats outgoing responses.
 * Each supported protocol (OpenAI, Anthropic) has its own adapter.
 */

import type { CanonicalRequest, CanonicalResponse, CanonicalStreamChunk } from "../canonical/types";

export interface ProtocolAdapter {
  readonly protocol: string;

  /** Parse raw HTTP request body → CanonicalRequest */
  parseRequest(body: unknown): CanonicalRequest;

  /** CanonicalResponse → protocol-specific response body */
  formatResponse(response: CanonicalResponse): unknown;

  /** CanonicalStreamChunk → protocol-specific SSE data line */
  formatStreamChunk(chunk: CanonicalStreamChunk): string;

  /** Format error into protocol-specific error response */
  formatError(status: number, message: string): unknown;
}
