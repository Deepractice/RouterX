/**
 * Router — model matching and provider selection
 *
 * Given a model name, find the best provider to serve it.
 */

import type { RegisteredProvider, RouteResult, RouterConfig } from "./types";

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
    // Find providers that explicitly list this model
    const candidates = this.providers
      .filter((p) => p.enabled !== false)
      .filter((p) => p.models.includes(model))
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    if (candidates.length > 0) {
      return { provider: candidates[0], model };
    }

    // Fallback to default provider
    if (this.defaultProviderId) {
      const defaultProvider = this.providers.find(
        (p) => p.id === this.defaultProviderId && p.enabled !== false
      );
      if (defaultProvider) {
        return { provider: defaultProvider, model };
      }
    }

    return null;
  }

  /**
   * List all available models across all providers
   */
  listModels(): Array<{ model: string; providerId: string; protocol: string }> {
    const models: Array<{ model: string; providerId: string; protocol: string }> = [];
    for (const provider of this.providers) {
      if (provider.enabled === false) continue;
      for (const model of provider.models) {
        models.push({
          model,
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
