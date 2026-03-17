import { expect } from "bun:test";
import type { DataTable } from "@deepracticex/bdd";
import { Given, Then, When } from "@deepracticex/bdd";
import type {
  CanonicalResponse,
  CanonicalStreamChunk,
} from "../../packages/core/src/canonical/types";
import type { RouterXWorld } from "../support/world";

// ============================================================================
// Helper
// ============================================================================

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

// ============================================================================
// REQUEST PARSING — Given + When
// ============================================================================

Given("an OpenAI format request body:", function (this: RouterXWorld, json: string) {
  this.requestBody = JSON.parse(json);
});

Given("an Anthropic format request body:", function (this: RouterXWorld, json: string) {
  this.requestBody = JSON.parse(json);
});

When("the OpenAI protocol adapter parses the request", function (this: RouterXWorld) {
  this.canonicalRequest = this.openaiAdapter.parseRequest(this.requestBody);
  this.activeAdapter = this.openaiAdapter;
});

When("the Anthropic protocol adapter parses the request", function (this: RouterXWorld) {
  this.canonicalRequest = this.anthropicAdapter.parseRequest(this.requestBody);
  this.activeAdapter = this.anthropicAdapter;
});

// ============================================================================
// CANONICAL REQUEST ASSERTIONS — Then
// ============================================================================

Then(
  "the canonical request should have model {string}",
  function (this: RouterXWorld, model: string) {
    expect(this.canonicalRequest!.model).toBe(model);
  }
);

Then(
  "the canonical request should have {int} messages",
  function (this: RouterXWorld, count: number) {
    expect(this.canonicalRequest!.messages).toHaveLength(count);
  }
);

Then(
  "the canonical request should have maxTokens {int}",
  function (this: RouterXWorld, tokens: number) {
    expect(this.canonicalRequest!.maxTokens).toBe(tokens);
  }
);

Then(
  "the canonical request should have temperature {float}",
  function (this: RouterXWorld, temp: number) {
    expect(this.canonicalRequest!.temperature).toBeCloseTo(temp, 5);
  }
);

Then("the canonical request should have {int} tool", function (this: RouterXWorld, count: number) {
  expect(this.canonicalRequest!.tools).toHaveLength(count);
});

Then("the first tool should have name {string}", function (this: RouterXWorld, name: string) {
  expect(this.canonicalRequest!.tools![0].name).toBe(name);
});

Then("the canonical request should have stream true", function (this: RouterXWorld) {
  expect(this.canonicalRequest!.stream).toBe(true);
});

Then("the first message should have role {string}", function (this: RouterXWorld, role: string) {
  expect(this.canonicalRequest!.messages[0].role).toBe(role);
});

// ============================================================================
// RESPONSE FORMATTING — Given + When
// ============================================================================

Given("a canonical response with:", function (this: RouterXWorld, dataTable: DataTable) {
  const kv = dataTable.rowsHash();
  (this as any).__canonicalResponse = {
    id: kv.id,
    model: kv.model,
    content: [{ type: "text", text: kv.content }],
    stopReason: kv.stopReason,
    usage: {
      inputTokens: parseInt(kv.inputTokens, 10),
      outputTokens: parseInt(kv.outputTokens, 10),
    },
  } as CanonicalResponse;
});

When("the OpenAI protocol adapter formats the response", function (this: RouterXWorld) {
  this.formattedResponse = this.openaiAdapter.formatResponse((this as any).__canonicalResponse);
});

When("the Anthropic protocol adapter formats the response", function (this: RouterXWorld) {
  this.formattedResponse = this.anthropicAdapter.formatResponse((this as any).__canonicalResponse);
});

// ============================================================================
// RESPONSE ASSERTIONS — Then
// ============================================================================

Then(
  "the response should have field {string} with value {string}",
  function (this: RouterXWorld, path: string, value: string) {
    const result = getNestedValue(this.formattedResponse, path);
    expect(result).toBe(value);
  }
);

Then(
  "the response should have a {string} array with {int} element",
  function (this: RouterXWorld, field: string, count: number) {
    const arr = getNestedValue(this.formattedResponse, field);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(count);
  }
);

Then(
  "the first choice should have {string} as {string}",
  function (this: RouterXWorld, path: string, value: string) {
    const choices = (this.formattedResponse as any).choices;
    const result = getNestedValue(choices[0], path);
    expect(result).toBe(value);
  }
);

Then(
  "the response should have {string} as {int}",
  function (this: RouterXWorld, path: string, value: number) {
    const result = getNestedValue(this.formattedResponse, path);
    expect(result).toBe(value);
  }
);

Then(
  "the first content block should have {string} as {string}",
  function (this: RouterXWorld, field: string, value: string) {
    const content = (this.formattedResponse as any).content;
    expect(content[0][field]).toBe(value);
  }
);

// ============================================================================
// STREAM CHUNK FORMATTING — Given + When
// ============================================================================

Given(
  "a canonical stream chunk of type {string} with text {string}",
  function (this: RouterXWorld, type: string, text: string) {
    (this as any).__streamChunkType = type;
    (this as any).__streamText = text;
  }
);

When("the OpenAI protocol adapter formats the stream chunk", function (this: RouterXWorld) {
  const chunk: CanonicalStreamChunk = {
    type: (this as any).__streamChunkType,
    data: { text: (this as any).__streamText },
  };
  this.formattedStreamChunk = this.openaiAdapter.formatStreamChunk(chunk);
});

When("the Anthropic protocol adapter formats the stream chunk", function (this: RouterXWorld) {
  const chunk: CanonicalStreamChunk = {
    type: (this as any).__streamChunkType,
    data: { text: (this as any).__streamText },
  };
  this.formattedStreamChunk = this.anthropicAdapter.formatStreamChunk(chunk);
});

// ============================================================================
// STREAM ASSERTIONS — Then
// ============================================================================

Then("the SSE data should be valid JSON", function (this: RouterXWorld) {
  expect(() => JSON.parse(this.formattedStreamChunk!)).not.toThrow();
});

Then(
  "the SSE data should have field {string} with value {string}",
  function (this: RouterXWorld, path: string, value: string) {
    // For Anthropic SSE, data is after "data: " prefix; for OpenAI it's raw JSON
    const raw = this.formattedStreamChunk!;
    const dataMatch = raw.match(/data: ({.*})/);
    const jsonStr = dataMatch ? dataMatch[1] : raw;
    const parsed = JSON.parse(jsonStr);
    const result = getNestedValue(parsed, path);
    expect(result).toBe(value);
  }
);

Then(
  "the SSE data should have a delta with content {string}",
  function (this: RouterXWorld, content: string) {
    const parsed = JSON.parse(this.formattedStreamChunk!);
    expect(parsed.choices[0].delta.content).toBe(content);
  }
);

Then("the SSE event should have type {string}", function (this: RouterXWorld, eventType: string) {
  expect(this.formattedStreamChunk).toContain(`event: ${eventType}`);
});

// ============================================================================
// ERROR FORMATTING — Given + When
// ============================================================================

Given(
  "an error with status {int} and message {string}",
  function (this: RouterXWorld, status: number, message: string) {
    (this as any).__errorStatus = status;
    (this as any).__errorMessage = message;
  }
);

When("the OpenAI protocol adapter formats the error", function (this: RouterXWorld) {
  this.formattedError = this.openaiAdapter.formatError(
    (this as any).__errorStatus,
    (this as any).__errorMessage
  );
});

When("the Anthropic protocol adapter formats the error", function (this: RouterXWorld) {
  this.formattedError = this.anthropicAdapter.formatError(
    (this as any).__errorStatus,
    (this as any).__errorMessage
  );
});

Then(
  "the error response should have field {string} with value {string}",
  function (this: RouterXWorld, path: string, value: string) {
    const result = getNestedValue(this.formattedError, path);
    expect(result).toBe(value);
  }
);
