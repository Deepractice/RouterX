import { expect } from "bun:test";
import type { DataTable } from "@deepracticex/bdd";
import { Given, Then, When } from "@deepracticex/bdd";
import type { RegisteredProvider } from "../../packages/core/src/router/types";
import { createRouterX } from "../../packages/routerx/src/app";
import type { RouterXWorld } from "../support/world";

// ============================================================================
// Given
// ============================================================================

Given("a RouterX server is running", function (this: RouterXWorld) {
  this.app = createRouterX({ router: { providers: [] } });
});

Given(
  "a RouterX server is running with providers:",
  function (this: RouterXWorld, dataTable: DataTable) {
    const rows = dataTable.hashes();
    const providers: RegisteredProvider[] = rows.map((row) => ({
      id: row.id,
      name: row.id,
      protocol: row.protocol as RegisteredProvider["protocol"],
      apiKey: "test-key",
      models: row.models.split(",").map((m: string) => m.trim()),
      priority: 1,
    }));
    // Store for potential mock setup
    (this as any).__providers = providers;
    this.app = createRouterX({ router: { providers } });
  }
);

Given("a mock OpenAI provider adapter is registered", function (this: RouterXWorld) {
  // With Vercel AI SDK, we don't inject mock adapters at this level.
  // The server test for actual routing requires a real provider.
  // For unit testing routing logic, use router.steps.ts instead.
});

Given("a mock Anthropic provider adapter is registered", function (this: RouterXWorld) {
  // Same as above
});

Given(
  "a RouterX server is running with API key {string}",
  function (this: RouterXWorld, apiKey: string) {
    const providers: RegisteredProvider[] = [
      {
        id: "openai",
        name: "OpenAI",
        protocol: "openai-compatible",
        apiKey: "test",
        models: ["gpt-4o"],
        priority: 1,
      },
    ];
    this.app = createRouterX({ router: { providers }, apiKey });
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
