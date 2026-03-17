Feature: Hono Server Endpoints
  The RouterX server exposes protocol endpoints and infrastructure routes.

  Scenario: Health check
    Given a RouterX server is running
    When I GET "/health"
    Then the response status should be 200
    And the response body should have field "status" with value "ok"

  Scenario: List models
    Given a RouterX server is running with providers:
      | id     | protocol          | models          |
      | openai | openai-compatible | gpt-4o,gpt-3.5 |
    When I GET "/v1/models"
    Then the response status should be 200
    And the response body should have field "object" with value "list"

  Scenario: Model not found returns 404
    Given a RouterX server is running with providers:
      | id     | protocol          | models |
      | openai | openai-compatible | gpt-4o |
    When I POST "/openai/v1/chat/completions" with:
      """
      {
        "model": "nonexistent-model",
        "messages": [{ "role": "user", "content": "Hello" }]
      }
      """
    Then the response status should be 404

  Scenario: Auth required when API key configured
    Given a RouterX server is running with API key "test-secret"
    When I POST "/openai/v1/chat/completions" without auth with:
      """
      {
        "model": "gpt-4o",
        "messages": [{ "role": "user", "content": "Hello" }]
      }
      """
    Then the response status should be 401
