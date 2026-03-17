@e2e
Feature: End-to-End — AgentX MonoDriver through RouterX
  Verify that AgentX with MonoDriver can use RouterX as its LLM backend.
  This is the real integration test — the way customers will actually use it.

  Scenario: AgentX with Anthropic protocol through RouterX
    Given RouterX is running locally
    And AgentX is configured to use RouterX with Anthropic protocol
    When I send a message "Say hello in one word" through AgentX
    Then I should receive a text response from the agent

  Scenario: AgentX with OpenAI protocol through RouterX
    Given RouterX is running locally
    And AgentX is configured to use RouterX with OpenAI protocol
    When I send a message "Say hello in one word" through AgentX
    Then I should receive a text response from the agent
