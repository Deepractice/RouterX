import { expect } from "bun:test";
import { Given, Then, When } from "@deepracticex/bdd";
import { OpenAIProviderAdapter } from "../../packages/core/src/provider/openai";
import type { RegisteredProvider } from "../../packages/core/src/router/types";
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

  const providers: RegisteredProvider[] = [
    {
      id: "ark",
      name: "Volcengine Ark",
      protocol: "openai",
      config: {
        apiKey: ARK_API_KEY,
        baseUrl: ARK_BASE_URL,
      },
      models: [
        "deepseek-v3-2-251201",
        "deepseek-r1-250528",
        "doubao-1-5-pro-32k-250115",
        "doubao-seed-2-0-pro-260215",
      ],
      priority: 1,
    },
  ];

  this.app = createRouterX({
    router: { providers },
    providerAdapters: {
      openai: new OpenAIProviderAdapter(),
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

Then("the response should contain assistant text", function (this: RouterXWorld) {
  const body = this.httpResponseBody;

  // OpenAI format
  if (body.choices) {
    const text = body.choices[0]?.message?.content;
    expect(text).toBeTruthy();
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    return;
  }

  // Anthropic format
  if (body.content) {
    const textBlock = body.content.find((c: any) => c.type === "text");
    expect(textBlock).toBeTruthy();
    expect(textBlock.text.length).toBeGreaterThan(0);
    return;
  }

  throw new Error(`Unexpected response format: ${JSON.stringify(body).slice(0, 200)}`);
});
