import { expect } from "bun:test";
import type { DataTable } from "@deepracticex/bdd";
import { Given, Then, When } from "@deepracticex/bdd";
import type { CanonicalRequest } from "../../packages/core/src/canonical/types";
import type { RegisteredProvider } from "../../packages/core/src/router/types";
import { createRouterX, type RouterXConfig } from "../../packages/server/src/app";
import type { RouterXWorld } from "../support/world";

// ============================================================================
// Mock provider adapters
// ============================================================================

function createMockProviderAdapter(protocol: string) {
  return {
    name: `mock-${protocol}`,
    protocol,
    async complete(request: CanonicalRequest) {
      return {
        id: "msg_mock_123",
        model: request.model,
        content: [{ type: "text" as const, text: "Mock response" }],
        stopReason: "end_turn" as const,
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    },
    async *stream(request: CanonicalRequest) {
      yield { type: "message_start" as const, data: { id: "msg_mock_123", model: request.model } };
      yield { type: "content_delta" as const, data: { text: "Mock" } };
      yield { type: "message_stop" as const, data: { stopReason: "end_turn" } };
    },
  };
}

function buildConfig(
  providers: RegisteredProvider[],
  providerAdapters: Record<string, any>,
  apiKey?: string
): RouterXConfig {
  return { router: { providers }, providerAdapters, apiKey };
}

// ============================================================================
// Given
// ============================================================================

Given("a RouterX server is running", function (this: RouterXWorld) {
  this.app = createRouterX(buildConfig([], {}));
});

Given(
  "a RouterX server is running with providers:",
  function (this: RouterXWorld, dataTable: DataTable) {
    const rows = dataTable.hashes();
    const providers: RegisteredProvider[] = rows.map((row) => ({
      id: row.id,
      name: row.id,
      protocol: row.protocol as "openai" | "anthropic",
      config: { apiKey: "test-key" },
      models: row.models.split(",").map((m: string) => m.trim()),
      priority: 1,
    }));
    (this as any).__providers = providers;
    this.app = createRouterX(buildConfig(providers, {}));
  }
);

Given("a mock OpenAI provider adapter is registered", function (this: RouterXWorld) {
  const providers = (this as any).__providers as RegisteredProvider[];
  this.app = createRouterX(buildConfig(providers, { openai: createMockProviderAdapter("openai") }));
});

Given("a mock Anthropic provider adapter is registered", function (this: RouterXWorld) {
  const providers = (this as any).__providers as RegisteredProvider[];
  this.app = createRouterX(
    buildConfig(providers, { anthropic: createMockProviderAdapter("anthropic") })
  );
});

Given(
  "a RouterX server is running with API key {string}",
  function (this: RouterXWorld, apiKey: string) {
    const providers: RegisteredProvider[] = [
      {
        id: "openai",
        name: "OpenAI",
        protocol: "openai",
        config: { apiKey: "test" },
        models: ["gpt-4o"],
        priority: 1,
      },
    ];
    this.app = createRouterX(
      buildConfig(providers, { openai: createMockProviderAdapter("openai") }, apiKey)
    );
  }
);

// ============================================================================
// When
// ============================================================================

When("I GET {string}", async function (this: RouterXWorld, path: string) {
  this.httpResponse = await this.app.request(path);
  this.httpResponseBody = await this.httpResponse.json();
});

When("I POST {string} with:", async function (this: RouterXWorld, path: string, body: string) {
  this.httpResponse = await this.app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
    body,
  });
  this.httpResponseBody = await this.httpResponse.json();
});

When(
  "I POST {string} without auth with:",
  async function (this: RouterXWorld, path: string, body: string) {
    this.httpResponse = await this.app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    this.httpResponseBody = await this.httpResponse.json();
  }
);

// ============================================================================
// Then
// ============================================================================

Then("the response status should be {int}", function (this: RouterXWorld, status: number) {
  expect(this.httpResponse!.status).toBe(status);
});

Then(
  "the response body should have field {string} with value {string}",
  function (this: RouterXWorld, path: string, value: string) {
    const result = path
      .split(".")
      .reduce((acc: any, key: string) => acc?.[key], this.httpResponseBody);
    expect(result).toBe(value);
  }
);
