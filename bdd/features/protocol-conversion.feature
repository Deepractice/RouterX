Feature: Cross-Protocol Conversion
  RouterX can receive requests in one protocol format
  and forward them to a provider that speaks a different protocol.
  This is the core differentiator — transparent cross-protocol routing.

  @pending
  Scenario: Anthropic client → OpenAI provider
    Given a client sends an Anthropic Messages format request for model "gpt-4o"
    And an OpenAI provider is configured with model "gpt-4o"
    When the request is routed through RouterX
    Then the upstream request should be in OpenAI Chat Completions format
    And the client should receive a response in Anthropic Messages format

  @pending
  Scenario: OpenAI client → Anthropic provider
    Given a client sends an OpenAI Chat Completions format request for model "claude-sonnet-4-20250514"
    And an Anthropic provider is configured with model "claude-sonnet-4-20250514"
    When the request is routed through RouterX
    Then the upstream request should be in Anthropic Messages format
    And the client should receive a response in OpenAI Chat Completions format

  @pending
  Scenario: Streaming cross-protocol conversion
    Given a client sends a streaming Anthropic Messages request for model "gpt-4o"
    And an OpenAI provider is configured with model "gpt-4o"
    When the request is routed through RouterX with streaming
    Then the upstream should receive an OpenAI streaming request
    And the client should receive Anthropic SSE formatted stream chunks

  @pending
  Scenario: Tool calls survive cross-protocol conversion
    Given a client sends an Anthropic request with tools for model "gpt-4o"
    And an OpenAI provider is configured with model "gpt-4o"
    When the request is routed through RouterX
    Then the tools should be correctly converted to OpenAI function format
    And tool call responses should be correctly converted back to Anthropic format
