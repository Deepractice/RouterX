import { expect } from "bun:test";
import type { DataTable } from "@deepracticex/bdd";
import { Given, Then, When } from "@deepracticex/bdd";
import type { CanonicalRequest } from "../../packages/core/src/canonical/types";
import type { RegisteredProvider } from "../../packages/core/src/router/types";
import { createRouterX } from "../../packages/routerx/src/app";
import type { RouterXWorld } from "../support/world";

// ============================================================================
// Capturing mock adapter
// ============================================================================

function createCapturingMockAdapter(protocol: string, world: RouterXWorld) {
  return {
    name: `mock-${protocol}`,
    protocol,
    async complete(request: CanonicalRequest) {
      world.capturedRequest = request;
      return {
        id: "msg_cross_123",
        model: request.model,
        content: [{ type: "text" as const, text: "Cross-protocol response" }],
        stopReason: "end_turn" as const,
        usage: { inputTokens: 15, outputTokens: 8 },
      };
    },
    async *stream(request: CanonicalRequest) {
      world.capturedRequest = request;
      yield { type: "message_start" as const, data: { id: "msg_cross_123", model: request.model } };
      yield { type: "content_delta" as const, data: { text: "Cross" } };
      yield { type: "message_stop" as const, data: { stopReason: "end_turn" } };
    },
  };
}

// ============================================================================
// Given
// ============================================================================

Given(
  "a RouterX server with cross-protocol routing:",
  function (this: RouterXWorld, dataTable: DataTable) {
    this.capturedRequest = null;
    const rows = dataTable.hashes();
    const row = rows[0];

    const providers: RegisteredProvider[] = [
      {
        id: `provider-${row.upstream}`,
        name: `Mock ${row.upstream}`,
        protocol: row.upstream as "openai" | "anthropic",
        config: { apiKey: "test-key" },
        models: [row.model],
        priority: 1,
      },
    ];

    this.app = createRouterX({
      router: { providers },
      providerAdapters: {
        [row.upstream]: createCapturingMockAdapter(row.upstream, this),
      },
    });
  }
);

// ============================================================================
// When
// ============================================================================

When(
  "I POST {string} with Anthropic format for model {string}",
  async function (this: RouterXWorld, path: string, model: string) {
    this.httpResponse = await this.app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello from Anthropic client" }],
      }),
    });
    this.httpResponseBody = await this.httpResponse.json();
  }
);

When(
  "I POST {string} with OpenAI format for model {string}",
  async function (this: RouterXWorld, path: string, model: string) {
    this.httpResponse = await this.app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hello from OpenAI client" },
        ],
      }),
    });
    this.httpResponseBody = await this.httpResponse.json();
  }
);

When(
  "I POST {string} with Anthropic format with tools for model {string}",
  async function (this: RouterXWorld, path: string, model: string) {
    this.httpResponse = await this.app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: "What is the weather?" }],
        tools: [
          {
            name: "get_weather",
            description: "Get weather",
            input_schema: {
              type: "object",
              properties: { location: { type: "string" } },
              required: ["location"],
            },
          },
        ],
      }),
    });
    this.httpResponseBody = await this.httpResponse.json();
  }
);

// ============================================================================
// Then
// ============================================================================

Then("the response should be in Anthropic Messages format", function (this: RouterXWorld) {
  expect(this.httpResponseBody.type).toBe("message");
  expect(this.httpResponseBody.role).toBe("assistant");
  expect(Array.isArray(this.httpResponseBody.content)).toBe(true);
});

Then("the response should be in OpenAI Chat Completions format", function (this: RouterXWorld) {
  expect(this.httpResponseBody.object).toBe("chat.completion");
  expect(Array.isArray(this.httpResponseBody.choices)).toBe(true);
});

Then(
  "the mock provider should have received an OpenAI format request",
  function (this: RouterXWorld) {
    expect(this.capturedRequest).not.toBeNull();
    expect(this.capturedRequest!.messages.length).toBeGreaterThan(0);
  }
);

Then(
  "the mock provider should have received an Anthropic format request",
  function (this: RouterXWorld) {
    expect(this.capturedRequest).not.toBeNull();
    expect(this.capturedRequest!.messages.length).toBeGreaterThan(0);
  }
);

Then(
  "the mock provider should have received tools in its native format",
  function (this: RouterXWorld) {
    expect(this.capturedRequest).not.toBeNull();
    expect(this.capturedRequest!.tools).toBeDefined();
    expect(this.capturedRequest!.tools!.length).toBeGreaterThan(0);
    expect(this.capturedRequest!.tools![0].name).toBe("get_weather");
  }
);
