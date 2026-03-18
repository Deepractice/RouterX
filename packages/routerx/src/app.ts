/**
 * RouterX Hono Application
 *
 * Routes:
 * - POST /openai/v1/chat/completions   — OpenAI protocol
 * - POST /anthropic/v1/messages        — Anthropic protocol
 * - GET  /v1/models                    — Model listing
 * - GET  /health                       — Health check
 *
 * Uses Vercel AI SDK for upstream LLM calls.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type RegisteredProvider, Router, type RouterConfig } from "@routerxjs/core";
import { generateText, type LanguageModel, streamText } from "ai";
import { Hono } from "hono";
import { stream } from "hono/streaming";

// ============================================================================
// Config
// ============================================================================

export interface RouterXConfig {
  /** Router configuration (providers, default) — creates a new Router */
  router?: RouterConfig;

  /** Pre-built Router instance — use this for dynamic config (e.g. from D1) */
  routerInstance?: Router;

  /** API key for authenticating incoming requests (optional) */
  apiKey?: string;
}

import { normalizeBaseUrl, PROTOCOL_DEFAULT_BASE } from "./baseurl";

// ============================================================================
// Vercel AI SDK model factory
// ============================================================================

function createModel(provider: RegisteredProvider, modelId: string): LanguageModel {
  const baseURL = provider.baseUrl
    ? normalizeBaseUrl(provider.baseUrl, provider.protocol)
    : PROTOCOL_DEFAULT_BASE[provider.protocol];

  switch (provider.protocol) {
    case "openai-compatible": {
      const p = createOpenAICompatible({
        name: provider.id,
        baseURL,
        apiKey: provider.apiKey,
      });
      return p(modelId);
    }
    case "anthropic": {
      const p = createAnthropic({
        baseURL,
        apiKey: provider.apiKey,
      });
      return p(modelId);
    }
    default:
      throw new Error(`Unsupported protocol: ${provider.protocol}`);
  }
}

// ============================================================================
// Parse incoming requests
// ============================================================================

interface ParsedRequest {
  model: string;
  messages: Array<{ role: string; content: any }>;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

function parseOpenAIRequest(body: any): ParsedRequest {
  return {
    model: body.model,
    messages: body.messages ?? [],
    maxTokens: body.max_tokens ?? body.max_completion_tokens,
    temperature: body.temperature,
    topP: body.top_p,
    stream: body.stream,
  };
}

function parseAnthropicRequest(body: any): ParsedRequest {
  return {
    model: body.model,
    messages: body.messages ?? [],
    system:
      typeof body.system === "string"
        ? body.system
        : Array.isArray(body.system)
          ? body.system
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n")
          : undefined,
    maxTokens: body.max_tokens,
    temperature: body.temperature,
    topP: body.top_p,
    stream: body.stream,
  };
}

// ============================================================================
// Convert to Vercel AI SDK messages
// ============================================================================

function toAIMessages(parsed: ParsedRequest): any[] {
  return parsed.messages.map((m: any) => {
    if (Array.isArray(m.content)) {
      const text = m.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("");
      return { role: m.role, content: text || "" };
    }
    return { role: m.role, content: m.content ?? "" };
  });
}

// ============================================================================
// Format responses
// ============================================================================

function formatOpenAIResponse(result: any, modelId: string): any {
  return {
    id: result.response?.id ?? `routerx-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: result.response?.modelId ?? modelId,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: result.text ?? "" },
        finish_reason:
          result.finishReason === "length"
            ? "length"
            : result.finishReason === "tool-calls"
              ? "tool_calls"
              : "stop",
      },
    ],
    usage: {
      prompt_tokens: result.usage?.promptTokens ?? 0,
      completion_tokens: result.usage?.completionTokens ?? 0,
      total_tokens: (result.usage?.promptTokens ?? 0) + (result.usage?.completionTokens ?? 0),
    },
  };
}

function formatAnthropicResponse(result: any, modelId: string): any {
  return {
    id: result.response?.id ?? `routerx-${Date.now()}`,
    type: "message",
    role: "assistant",
    model: result.response?.modelId ?? modelId,
    content: [{ type: "text", text: result.text ?? "" }],
    stop_reason:
      result.finishReason === "length"
        ? "max_tokens"
        : result.finishReason === "tool-calls"
          ? "tool_use"
          : "end_turn",
    usage: {
      input_tokens: result.usage?.promptTokens ?? 0,
      output_tokens: result.usage?.completionTokens ?? 0,
    },
  };
}

// ============================================================================
// Streaming formatters
// ============================================================================

function openAIStreamFormatter() {
  return {
    onChunk(chunk: any): string | null {
      if (chunk.type === "text-delta" && chunk.text) {
        return `data: ${JSON.stringify({
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: { content: chunk.text }, finish_reason: null }],
        })}\n\n`;
      }
      return null;
    },
    onFinish(result: any): string {
      let out = `data: ${JSON.stringify({
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: {
          prompt_tokens: result.usage?.promptTokens ?? 0,
          completion_tokens: result.usage?.completionTokens ?? 0,
          total_tokens: (result.usage?.promptTokens ?? 0) + (result.usage?.completionTokens ?? 0),
        },
      })}\n\n`;
      out += "data: [DONE]\n\n";
      return out;
    },
  };
}

function anthropicStreamFormatter() {
  let blockStarted = false;
  return {
    onStart(modelId: string): string {
      return `event: message_start\ndata: ${JSON.stringify({
        type: "message_start",
        message: {
          id: `routerx-${Date.now()}`,
          type: "message",
          role: "assistant",
          model: modelId,
          content: [],
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      })}\n\n`;
    },
    onChunk(chunk: any): string | null {
      if (chunk.type === "text-delta" && chunk.text) {
        let sse = "";
        if (!blockStarted) {
          blockStarted = true;
          sse += `event: content_block_start\ndata: ${JSON.stringify({
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          })}\n\n`;
        }
        sse += `event: content_block_delta\ndata: ${JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: chunk.text },
        })}\n\n`;
        return sse;
      }
      return null;
    },
    onFinish(result: any): string {
      let sse = "";
      sse += `event: content_block_stop\ndata: ${JSON.stringify({
        type: "content_block_stop",
        index: 0,
      })}\n\n`;
      sse += `event: message_delta\ndata: ${JSON.stringify({
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: result.usage?.completionTokens ?? 0 },
      })}\n\n`;
      sse += `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;
      return sse;
    },
  };
}

// ============================================================================
// App Factory
// ============================================================================

export function createRouterX(config: RouterXConfig) {
  const app = new Hono();
  const router = config.routerInstance ?? new Router(config.router ?? { providers: [] });

  // Auth middleware
  if (config.apiKey) {
    app.use("*", async (c, next) => {
      if (c.req.path === "/health") return next();
      const auth = c.req.header("Authorization");
      const apiKey = c.req.header("x-api-key");
      const token = auth?.replace("Bearer ", "") ?? apiKey;
      if (token !== config.apiKey) {
        return c.json({ error: { message: "Invalid API key", type: "authentication_error" } }, 401);
      }
      return next();
    });
  }

  // OpenAI endpoint
  app.post("/openai/v1/chat/completions", async (c) => {
    return handleRequest(c, parseOpenAIRequest(await c.req.json()), "openai");
  });

  // Anthropic endpoint
  app.post("/anthropic/v1/messages", async (c) => {
    return handleRequest(c, parseAnthropicRequest(await c.req.json()), "anthropic");
  });

  // Model list
  app.get("/v1/models", (c) => {
    const models = router.listModels();
    return c.json({
      object: "list",
      data: models.map((m) => ({ id: m.model, object: "model", owned_by: m.providerId })),
    });
  });

  // Health
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Core handler
  async function handleRequest(c: any, parsed: ParsedRequest, downstream: "openai" | "anthropic") {
    try {
      const routeResult = router.route(parsed.model);
      if (!routeResult) {
        return c.json({ error: { message: `Model "${parsed.model}" not found` } }, 404);
      }

      const model = createModel(routeResult.provider, routeResult.upstreamModel);
      const messages = toAIMessages(parsed);

      if (parsed.stream) {
        const fmt =
          downstream === "anthropic" ? anthropicStreamFormatter() : openAIStreamFormatter();

        const result = streamText({
          model,
          messages,
          system: parsed.system,
          maxOutputTokens: parsed.maxTokens,
          temperature: parsed.temperature,
          topP: parsed.topP,
        });

        return stream(c, async (s) => {
          try {
            if ("onStart" in fmt) {
              await s.write((fmt as any).onStart(routeResult.model));
            }
            for await (const chunk of result.fullStream) {
              const formatted = fmt.onChunk(chunk);
              if (formatted) await s.write(formatted);
            }
            const final = await result;
            await s.write(fmt.onFinish(final));
          } catch (err: any) {
            await s.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          }
        });
      }

      // Non-streaming
      const result = await generateText({
        model,
        messages,
        system: parsed.system,
        maxOutputTokens: parsed.maxTokens,
        temperature: parsed.temperature,
        topP: parsed.topP,
      });

      return c.json(
        downstream === "anthropic"
          ? formatAnthropicResponse(result, routeResult.model)
          : formatOpenAIResponse(result, routeResult.model)
      );
    } catch (err: any) {
      return c.json({ error: { message: err.message ?? "Internal error" } }, 500);
    }
  }

  return app;
}
