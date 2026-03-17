import { expect } from "bun:test";
import type { Driver } from "@agentxjs/core/driver";
import { createMonoDriver } from "@agentxjs/mono-driver";
import { Given, Then, When } from "@deepracticex/bdd";
import { createRouterX } from "../../packages/routerx/src/app";

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_BASE_URL = process.env.ARK_BASE_URL;

let server: any;
let driver: Driver;
let collectedText: string;

function ensureServer() {
  if (server) return;
  if (!ARK_API_KEY || !ARK_BASE_URL) {
    throw new Error("ARK_API_KEY and ARK_BASE_URL must be set");
  }

  const app = createRouterX({
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

  server = Bun.serve({ fetch: app.fetch, port: 3799 });
}

// ============================================================================
// Given
// ============================================================================

Given("RouterX is running locally", () => {
  ensureServer();
});

Given("AgentX is configured to use RouterX with Anthropic protocol", async () => {
  driver = createMonoDriver({
    apiKey: "routerx-test",
    baseUrl: "http://localhost:3799/anthropic/v1",
    model: "deepseek-v3-2-251201",
    instanceId: "e2e-anthropic",
    provider: "anthropic",
  });
  await driver.initialize();
});

Given("AgentX is configured to use RouterX with OpenAI protocol", async () => {
  driver = createMonoDriver({
    apiKey: "routerx-test",
    model: "deepseek-v3-2-251201",
    instanceId: "e2e-openai",
    provider: "openai-compatible",
    compatibleConfig: {
      name: "routerx",
      baseURL: "http://localhost:3799/openai/v1",
      apiKey: "routerx-test",
    },
  });
  await driver.initialize();
});

// ============================================================================
// When
// ============================================================================

When("I send a message {string} through AgentX", async (message: string) => {
  collectedText = "";
  for await (const event of driver.receive({ content: message })) {
    if (event.type === "text_delta") {
      collectedText += (event.data as any).text;
    }
  }
});

// ============================================================================
// Then
// ============================================================================

Then("I should receive a text response from the agent", async () => {
  expect(collectedText.length).toBeGreaterThan(0);
  console.log(`    Agent replied: "${collectedText.trim()}"`);
  await driver.dispose();
});
