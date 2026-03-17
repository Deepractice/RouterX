Feature: Cross-Protocol Conversion
  RouterX can receive requests in one protocol format
  and forward them to a provider that speaks a different protocol.
  This is the core differentiator — transparent cross-protocol routing.

  Scenario: Anthropic client → OpenAI provider
    Given a RouterX server with cross-protocol routing:
      | downstream | upstream | model  |
      | anthropic  | openai   | gpt-4o |
    When I POST "/anthropic/v1/messages" with Anthropic format for model "gpt-4o"
    Then the response status should be 200
    And the response should be in Anthropic Messages format
    And the mock provider should have received an OpenAI format request

  Scenario: OpenAI client → Anthropic provider
    Given a RouterX server with cross-protocol routing:
      | downstream | upstream  | model                    |
      | openai     | anthropic | claude-sonnet-4-20250514 |
    When I POST "/openai/v1/chat/completions" with OpenAI format for model "claude-sonnet-4-20250514"
    Then the response status should be 200
    And the response should be in OpenAI Chat Completions format
    And the mock provider should have received an Anthropic format request

  Scenario: Tool calls survive cross-protocol conversion
    Given a RouterX server with cross-protocol routing:
      | downstream | upstream | model  |
      | anthropic  | openai   | gpt-4o |
    When I POST "/anthropic/v1/messages" with Anthropic format with tools for model "gpt-4o"
    Then the response status should be 200
    And the mock provider should have received tools in its native format
