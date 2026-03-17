import { expect } from "bun:test";
import { Given, Then, When } from "@deepracticex/bdd";
import { createRouterX } from "../../packages/routerx/src/app";
import type { RouterXWorld } from "../support/world";

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_BASE_URL = process.env.ARK_BASE_URL;

// ============================================================================
// Given
// ============================================================================

Given("RouterX is configured with Ark provider", function (this: RouterXWorld) {
  if (!ARK_API_KEY || !ARK_BASE_URL) {
    throw new Error("ARK_API_KEY and ARK_BASE_URL must be set in .env.local");
  }

  this.app = createRouterX({
    router: {
      providers: [
        {
          id: "ark",
          name: "Volcengine Ark",
          protocol: "openai-compatible",
          apiKey: ARK_API_KEY,
          baseUrl: ARK_BASE_URL,
          models: ["deepseek-v3-2-251201"],
          priority: 1,
        },
      ],
    },
  });
});

// ============================================================================
// When
// ============================================================================

When(
  "I send an OpenAI format request to {string} with model {string}:",
  async function (this: RouterXWorld, path: string, model: string, prompt: string) {
    this.httpResponse = await this.app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt.trim() }],
        max_tokens: 32,
      }),
    });
    this.httpResponseBody = await this.httpResponse.json();
  }
);

When(
  "I send an Anthropic format request to {string} with model {string}:",
  async function (this: RouterXWorld, path: string, model: string, prompt: string) {
    this.httpResponse = await this.app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 32,
        messages: [{ role: "user", content: prompt.trim() }],
      }),
    });
    this.httpResponseBody = await this.httpResponse.json();
  }
);

// ============================================================================
// Then
// ============================================================================

Then("the response should be in OpenAI Chat Completions format", function (this: RouterXWorld) {
  expect(this.httpResponseBody.object).toBe("chat.completion");
  expect(Array.isArray(this.httpResponseBody.choices)).toBe(true);
});

Then("the response should be in Anthropic Messages format", function (this: RouterXWorld) {
  expect(this.httpResponseBody.type).toBe("message");
  expect(this.httpResponseBody.role).toBe("assistant");
  expect(Array.isArray(this.httpResponseBody.content)).toBe(true);
});

Then("the response should contain assistant text", function (this: RouterXWorld) {
  const body = this.httpResponseBody;
  if (body.choices) {
    expect(body.choices[0]?.message?.content?.length).toBeGreaterThan(0);
    return;
  }
  if (body.content) {
    const textBlock = body.content.find((c: any) => c.type === "text");
    expect(textBlock?.text?.length).toBeGreaterThan(0);
    return;
  }
  throw new Error(`Unexpected response: ${JSON.stringify(body).slice(0, 200)}`);
});
