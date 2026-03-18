/**
 * Router Types — routing configuration and model matching
 */

/**
 * Supported upstream provider protocols
 */
export type ProviderProtocol = "openai-compatible" | "anthropic";

/**
 * Model entry — either a plain string or an object with upstream mapping
 *
 * Plain string: model name is the same on both sides
 * Object: name is what clients request, upstreamModel is what the provider expects
 *
 * @example
 * // Simple — same name both sides
 * "gpt-4o"
 *
 * // Mapped — "deepseek-v3" externally, "ep-xxx" at the provider
 * { name: "deepseek-v3", upstreamModel: "ep-20250101-xxx" }
 */
export type ModelEntry = string | { name: string; upstreamModel: string };

/**
 * A registered upstream provider with its capabilities
 */
export interface RegisteredProvider {
  /** Unique provider ID */
  id: string;

  /** Display name */
  name: string;

  /** Protocol this provider speaks */
  protocol: ProviderProtocol;

  /** API key */
  apiKey: string;

  /** Custom base URL */
  baseUrl?: string;

  /** Models this provider can serve */
  models: ModelEntry[];

  /** Priority for model matching (lower = higher priority) */
  priority?: number;

  /** Whether this provider is enabled */
  enabled?: boolean;
}

/**
 * The result of routing a request to a provider
 */
export interface RouteResult {
  /** The matched provider */
  provider: RegisteredProvider;

  /** The model name as requested by the client */
  model: string;

  /** The model name to send to the upstream provider (may differ from model) */
  upstreamModel: string;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Registered providers */
  providers: RegisteredProvider[];

  /** Default provider ID (fallback when no model match) */
  defaultProviderId?: string;
}
