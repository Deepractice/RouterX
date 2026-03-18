/**
 * Router — model matching and provider selection
 *
 * Given a model name, find the best provider to serve it.
 * Supports model name mapping (client name → upstream provider name).
 */

import type { ModelEntry, RegisteredProvider, RouteResult, RouterConfig } from "./types";

/** Resolve a ModelEntry to its client-facing name */
function modelName(entry: ModelEntry): string {
  return typeof entry === "string" ? entry : entry.name;
}

/** Resolve a ModelEntry to its upstream name */
function upstreamModelName(entry: ModelEntry): string {
  return typeof entry === "string" ? entry : entry.upstreamModel;
}

export class Router {
  private providers: RegisteredProvider[];
  private defaultProviderId?: string;

  constructor(config: RouterConfig) {
    this.providers = config.providers;
    this.defaultProviderId = config.defaultProviderId;
  }

  /**
   * Find the best provider for a given model
   */
  route(model: string): RouteResult | null {
    // Find providers that have this model (by client-facing name)
    const candidates: Array<{ provider: RegisteredProvider; entry: ModelEntry }> = [];

    for (const provider of this.providers) {
      if (provider.enabled === false) continue;
      const entry = provider.models.find((m) => modelName(m) === model);
      if (entry) {
        candidates.push({ provider, entry });
      }
    }

    // Sort by priority
    candidates.sort((a, b) => (a.provider.priority ?? 100) - (b.provider.priority ?? 100));

    if (candidates.length > 0) {
      const { provider, entry } = candidates[0];
      return {
        provider,
        model,
        upstreamModel: upstreamModelName(entry),
      };
    }

    // Fallback to default provider
    if (this.defaultProviderId) {
      const defaultProvider = this.providers.find(
        (p) => p.id === this.defaultProviderId && p.enabled !== false
      );
      if (defaultProvider) {
        return { provider: defaultProvider, model, upstreamModel: model };
      }
    }

    return null;
  }

  /**
   * List all available models across all providers
   */
  listModels(): Array<{
    model: string;
    upstreamModel: string;
    providerId: string;
    protocol: string;
  }> {
    const models: Array<{
      model: string;
      upstreamModel: string;
      providerId: string;
      protocol: string;
    }> = [];
    for (const provider of this.providers) {
      if (provider.enabled === false) continue;
      for (const entry of provider.models) {
        models.push({
          model: modelName(entry),
          upstreamModel: upstreamModelName(entry),
          providerId: provider.id,
          protocol: provider.protocol,
        });
      }
    }
    return models;
  }

  /**
   * Add a provider at runtime
   */
  addProvider(provider: RegisteredProvider): void {
    const existing = this.providers.findIndex((p) => p.id === provider.id);
    if (existing >= 0) {
      this.providers[existing] = provider;
    } else {
      this.providers.push(provider);
    }
  }

  /**
   * Remove a provider
   */
  removeProvider(id: string): boolean {
    const idx = this.providers.findIndex((p) => p.id === id);
    if (idx >= 0) {
      this.providers.splice(idx, 1);
      return true;
    }
    return false;
  }
}
