@e2e
Feature: End-to-End — Volcengine Ark Provider
  Test RouterX with a real LLM provider (Volcengine Ark / 火山引擎).
  Ark uses OpenAI-compatible protocol, so this validates the full pipeline.

  Scenario: OpenAI client → Ark provider (non-streaming)
    Given RouterX is configured with Ark provider
    When I send an OpenAI format request to "/v1/chat/completions" with model "deepseek-v3-2-251201":
      """
      Say "hello" in one word. Nothing else.
      """
    Then the response status should be 200
    And the response should be in OpenAI Chat Completions format
    And the response should contain assistant text

  Scenario: Anthropic client → Ark provider (cross-protocol, non-streaming)
    Given RouterX is configured with Ark provider
    When I send an Anthropic format request to "/v1/messages" with model "deepseek-v3-2-251201":
      """
      Say "hello" in one word. Nothing else.
      """
    Then the response status should be 200
    And the response should be in Anthropic Messages format
    And the response should contain assistant text
