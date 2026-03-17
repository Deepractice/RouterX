/**
 * Router Types — routing configuration and model matching
 */

/**
 * Supported upstream provider protocols
 */
export type ProviderProtocol = "openai-compatible" | "anthropic";

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
  models: string[];

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

  /** The model to use (may be remapped) */
  model: string;
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
