/**
 * RouterX Hono Application
 *
 * Cross-platform HTTP server exposing:
 * - POST /v1/chat/completions — OpenAI protocol endpoint
 * - POST /v1/messages — Anthropic protocol endpoint
 * - POST /rpc — Management API
 */

import {
  AnthropicProtocolAdapter,
  type CanonicalRequest,
  OpenAIProtocolAdapter,
  type ProtocolAdapter,
  type ProviderAdapter,
  Router,
  type RouterConfig,
} from "@routerxjs/core";
import { Hono } from "hono";
import { stream } from "hono/streaming";

// ============================================================================
// Config
// ============================================================================

export interface RouterXConfig {
  /** Router configuration (providers, default) */
  router: RouterConfig;

  /** Provider adapter registry — protocol name → adapter instance */
  providerAdapters: Record<string, ProviderAdapter>;

  /** API key for authenticating incoming requests (optional) */
  apiKey?: string;
}

// ============================================================================
// App Factory
// ============================================================================

export function createRouterX(config: RouterXConfig) {
  const app = new Hono();
  const router = new Router(config.router);
  const openaiProtocol = new OpenAIProtocolAdapter();
  const anthropicProtocol = new AnthropicProtocolAdapter();

  // === Auth middleware ===
  if (config.apiKey) {
    app.use("*", async (c, next) => {
      const auth = c.req.header("Authorization");
      const apiKey = c.req.header("x-api-key");
      const token = auth?.replace("Bearer ", "") ?? apiKey;

      if (token !== config.apiKey) {
        return c.json(openaiProtocol.formatError(401, "Invalid API key"), 401);
      }
      return next();
    });
  }

  // === OpenAI endpoint ===
  app.post("/v1/chat/completions", async (c) => {
    return handleRequest(c, openaiProtocol);
  });

  // === Anthropic endpoint ===
  app.post("/v1/messages", async (c) => {
    return handleRequest(c, anthropicProtocol);
  });

  // === Model list ===
  app.get("/v1/models", (c) => {
    const models = router.listModels();
    return c.json({
      object: "list",
      data: models.map((m) => ({
        id: m.model,
        object: "model",
        owned_by: m.providerId,
      })),
    });
  });

  // === Health ===
  app.get("/health", (c) => c.json({ status: "ok" }));

  // === Request handler ===
  async function handleRequest(c: any, protocolAdapter: ProtocolAdapter) {
    try {
      const body = await c.req.json();
      const canonical = protocolAdapter.parseRequest(body);

      // Route to provider
      const routeResult = router.route(canonical.model);
      if (!routeResult) {
        const err = protocolAdapter.formatError(404, `Model "${canonical.model}" not found`);
        return c.json(err, 404);
      }

      const providerAdapter = config.providerAdapters[routeResult.provider.protocol];
      if (!providerAdapter) {
        const err = protocolAdapter.formatError(
          500,
          `No provider adapter for protocol "${routeResult.provider.protocol}"`
        );
        return c.json(err, 500);
      }

      // Update model in canonical request if remapped
      const request: CanonicalRequest = {
        ...canonical,
        model: routeResult.model,
      };

      // Streaming vs non-streaming
      if (canonical.stream) {
        return stream(c, async (s) => {
          try {
            for await (const chunk of providerAdapter.stream(
              request,
              routeResult.provider.config
            )) {
              const formatted = protocolAdapter.formatStreamChunk(chunk);
              if (formatted) {
                await s.write(`data: ${formatted}\n\n`);
              }
            }
            await s.write("data: [DONE]\n\n");
          } catch (err: any) {
            const errFormatted = protocolAdapter.formatError(500, err.message ?? "Stream error");
            await s.write(`data: ${JSON.stringify(errFormatted)}\n\n`);
          }
        });
      }

      // Non-streaming
      const response = await providerAdapter.complete(request, routeResult.provider.config);
      const formatted = protocolAdapter.formatResponse(response);
      return c.json(formatted);
    } catch (err: any) {
      const errFormatted = protocolAdapter.formatError(500, err.message ?? "Internal error");
      return c.json(errFormatted, 500);
    }
  }

  return app;
}
