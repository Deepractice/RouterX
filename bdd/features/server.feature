Feature: Hono Server Endpoints
  The RouterX server exposes OpenAI and Anthropic protocol endpoints
  and routes requests to the appropriate upstream provider.

  Scenario: Health check
    Given a RouterX server is running
    When I GET "/health"
    Then the response status should be 200
    And the response body should have field "status" with value "ok"

  Scenario: List models
    Given a RouterX server is running with providers:
      | id     | protocol | models         |
      | openai | openai   | gpt-4o,gpt-3.5 |
    When I GET "/v1/models"
    Then the response status should be 200
    And the response body should have field "object" with value "list"

  Scenario: OpenAI endpoint routes to provider
    Given a RouterX server is running with providers:
      | id     | protocol | models |
      | openai | openai   | gpt-4o |
    And a mock OpenAI provider adapter is registered
    When I POST "/v1/chat/completions" with:
      """
      {
        "model": "gpt-4o",
        "messages": [{ "role": "user", "content": "Hello" }]
      }
      """
    Then the response status should be 200
    And the response body should have field "object" with value "chat.completion"

  Scenario: Anthropic endpoint routes to provider
    Given a RouterX server is running with providers:
      | id        | protocol  | models                   |
      | anthropic | anthropic | claude-sonnet-4-20250514 |
    And a mock Anthropic provider adapter is registered
    When I POST "/v1/messages" with:
      """
      {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "messages": [{ "role": "user", "content": "Hello" }]
      }
      """
    Then the response status should be 200
    And the response body should have field "type" with value "message"

  Scenario: Model not found returns 404
    Given a RouterX server is running with providers:
      | id     | protocol | models |
      | openai | openai   | gpt-4o |
    When I POST "/v1/chat/completions" with:
      """
      {
        "model": "nonexistent-model",
        "messages": [{ "role": "user", "content": "Hello" }]
      }
      """
    Then the response status should be 404

  Scenario: Auth required when API key configured
    Given a RouterX server is running with API key "test-secret"
    When I POST "/v1/chat/completions" without auth with:
      """
      {
        "model": "gpt-4o",
        "messages": [{ "role": "user", "content": "Hello" }]
      }
      """
    Then the response status should be 401
