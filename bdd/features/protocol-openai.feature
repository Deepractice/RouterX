Feature: OpenAI Chat Completions Protocol
  RouterX supports the OpenAI Chat Completions API format
  as both a downstream protocol (client-facing) and upstream protocol (provider-facing).

  # ============================================================
  # Downstream: Parse client requests in OpenAI format
  # ============================================================

  Scenario: Parse a basic chat completion request
    Given an OpenAI format request body:
      """
      {
        "model": "gpt-4o",
        "messages": [
          { "role": "system", "content": "You are a helpful assistant." },
          { "role": "user", "content": "Hello" }
        ],
        "max_tokens": 1024,
        "temperature": 0.7
      }
      """
    When the OpenAI protocol adapter parses the request
    Then the canonical request should have model "gpt-4o"
    And the canonical request should have 2 messages
    And the canonical request should have maxTokens 1024
    And the canonical request should have temperature 0.7

  Scenario: Parse a request with tools
    Given an OpenAI format request body:
      """
      {
        "model": "gpt-4o",
        "messages": [
          { "role": "user", "content": "What is the weather?" }
        ],
        "tools": [
          {
            "type": "function",
            "function": {
              "name": "get_weather",
              "description": "Get current weather",
              "parameters": {
                "type": "object",
                "properties": {
                  "location": { "type": "string" }
                },
                "required": ["location"]
              }
            }
          }
        ]
      }
      """
    When the OpenAI protocol adapter parses the request
    Then the canonical request should have 1 tool
    And the first tool should have name "get_weather"

  Scenario: Parse a streaming request
    Given an OpenAI format request body:
      """
      {
        "model": "gpt-4o",
        "messages": [
          { "role": "user", "content": "Hello" }
        ],
        "stream": true
      }
      """
    When the OpenAI protocol adapter parses the request
    Then the canonical request should have stream true

  # ============================================================
  # Downstream: Format responses to OpenAI format
  # ============================================================

  Scenario: Format a canonical response to OpenAI format
    Given a canonical response with:
      | field       | value                |
      | id          | msg_123              |
      | model       | gpt-4o               |
      | content     | Hello! How can I help? |
      | stopReason  | end_turn             |
      | inputTokens | 10                   |
      | outputTokens| 8                    |
    When the OpenAI protocol adapter formats the response
    Then the response should have field "id" with value "msg_123"
    And the response should have field "object" with value "chat.completion"
    And the response should have a "choices" array with 1 element
    And the first choice should have "message.role" as "assistant"
    And the first choice should have "message.content" as "Hello! How can I help?"
    And the first choice should have "finish_reason" as "stop"
    And the response should have "usage.prompt_tokens" as 10
    And the response should have "usage.completion_tokens" as 8

  Scenario: Format a streaming chunk to OpenAI SSE format
    Given a canonical stream chunk of type "content_delta" with text "Hello"
    When the OpenAI protocol adapter formats the stream chunk
    Then the SSE data should be valid JSON
    And the SSE data should have field "object" with value "chat.completion.chunk"
    And the SSE data should have a delta with content "Hello"

  # ============================================================
  # Downstream: Format errors to OpenAI format
  # ============================================================

  Scenario: Format an error to OpenAI format
    Given an error with status 401 and message "Invalid API key"
    When the OpenAI protocol adapter formats the error
    Then the error response should have field "error.message" with value "Invalid API key"
    And the error response should have field "error.type" with value "authentication_error"
