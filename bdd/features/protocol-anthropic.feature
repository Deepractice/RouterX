Feature: Anthropic Messages Protocol
  RouterX supports the Anthropic Messages API format
  as both a downstream protocol (client-facing) and upstream protocol (provider-facing).

  # ============================================================
  # Downstream: Parse client requests in Anthropic format
  # ============================================================

  Scenario: Parse a basic messages request
    Given an Anthropic format request body:
      """
      {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "system": "You are a helpful assistant.",
        "messages": [
          { "role": "user", "content": "Hello" }
        ]
      }
      """
    When the Anthropic protocol adapter parses the request
    Then the canonical request should have model "claude-sonnet-4-20250514"
    And the canonical request should have 2 messages
    And the first message should have role "system"
    And the canonical request should have maxTokens 1024

  Scenario: Parse a request with tool use
    Given an Anthropic format request body:
      """
      {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "messages": [
          { "role": "user", "content": "What is the weather?" }
        ],
        "tools": [
          {
            "name": "get_weather",
            "description": "Get current weather",
            "input_schema": {
              "type": "object",
              "properties": {
                "location": { "type": "string" }
              },
              "required": ["location"]
            }
          }
        ]
      }
      """
    When the Anthropic protocol adapter parses the request
    Then the canonical request should have 1 tool
    And the first tool should have name "get_weather"

  Scenario: Parse a streaming request
    Given an Anthropic format request body:
      """
      {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "messages": [
          { "role": "user", "content": "Hello" }
        ],
        "stream": true
      }
      """
    When the Anthropic protocol adapter parses the request
    Then the canonical request should have stream true

  # ============================================================
  # Downstream: Format responses to Anthropic format
  # ============================================================

  Scenario: Format a canonical response to Anthropic format
    Given a canonical response with:
      | field       | value                |
      | id          | msg_123              |
      | model       | claude-sonnet-4-20250514 |
      | content     | Hello! How can I help? |
      | stopReason  | end_turn             |
      | inputTokens | 10                   |
      | outputTokens| 8                    |
    When the Anthropic protocol adapter formats the response
    Then the response should have field "id" with value "msg_123"
    And the response should have field "type" with value "message"
    And the response should have field "role" with value "assistant"
    And the response should have a "content" array with 1 element
    And the first content block should have "type" as "text"
    And the first content block should have "text" as "Hello! How can I help?"
    And the response should have field "stop_reason" with value "end_turn"
    And the response should have "usage.input_tokens" as 10
    And the response should have "usage.output_tokens" as 8

  Scenario: Format a streaming chunk to Anthropic SSE format
    Given a canonical stream chunk of type "content_delta" with text "Hello"
    When the Anthropic protocol adapter formats the stream chunk
    Then the SSE event should have type "content_block_delta"
    And the SSE data should have field "delta.type" with value "text_delta"
    And the SSE data should have field "delta.text" with value "Hello"

  # ============================================================
  # Downstream: Format errors to Anthropic format
  # ============================================================

  Scenario: Format an error to Anthropic format
    Given an error with status 401 and message "Invalid API key"
    When the Anthropic protocol adapter formats the error
    Then the error response should have field "type" with value "error"
    And the error response should have field "error.type" with value "authentication_error"
    And the error response should have field "error.message" with value "Invalid API key"
