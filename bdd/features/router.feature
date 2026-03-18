Feature: Router Engine
  The router matches model names to configured providers
  and selects the best provider based on priority.

  Scenario: Route to a provider that has the model
    Given the following providers are registered:
      | id       | name      | protocol          | models                   | priority |
      | openai   | OpenAI    | openai-compatible | gpt-4o,gpt-3.5          | 1        |
      | anthropic| Anthropic | anthropic         | claude-sonnet-4-20250514 | 1        |
    When I route model "gpt-4o"
    Then the route should match provider "openai"

  Scenario: Route to Anthropic provider
    Given the following providers are registered:
      | id       | name      | protocol          | models                   | priority |
      | openai   | OpenAI    | openai-compatible | gpt-4o                   | 1        |
      | anthropic| Anthropic | anthropic         | claude-sonnet-4-20250514 | 1        |
    When I route model "claude-sonnet-4-20250514"
    Then the route should match provider "anthropic"

  Scenario: Fallback to default provider when model not found
    Given the following providers are registered:
      | id     | name   | protocol          | models | priority |
      | openai | OpenAI | openai-compatible | gpt-4o | 1        |
    And the default provider is "openai"
    When I route model "unknown-model"
    Then the route should match provider "openai"
    And the routed model should be "unknown-model"

  Scenario: Return null when no provider matches and no default
    Given the following providers are registered:
      | id     | name   | protocol          | models | priority |
      | openai | OpenAI | openai-compatible | gpt-4o | 1        |
    When I route model "unknown-model"
    Then the route should be null

  Scenario: Higher priority provider wins
    Given the following providers are registered:
      | id         | name       | protocol          | models | priority |
      | provider-a | Provider A | openai-compatible | gpt-4o | 10       |
      | provider-b | Provider B | openai-compatible | gpt-4o | 1        |
    When I route model "gpt-4o"
    Then the route should match provider "provider-b"

  Scenario: Disabled providers are skipped
    Given the following providers are registered:
      | id       | name     | protocol          | models | priority | enabled |
      | disabled | Disabled | openai-compatible | gpt-4o | 1        | false   |
      | enabled  | Enabled  | openai-compatible | gpt-4o | 2        | true    |
    When I route model "gpt-4o"
    Then the route should match provider "enabled"

  Scenario: Model name mapping — client name differs from upstream
    Given a provider "ark" with mapped models:
      | name       | upstreamModel            |
      | deepseek-v3| ep-20250101-deepseek-v3  |
      | doubao-pro | ep-20250101-doubao-pro   |
    When I route model "deepseek-v3"
    Then the route should match provider "ark"
    And the upstream model should be "ep-20250101-deepseek-v3"

  Scenario: List all available models
    Given the following providers are registered:
      | id       | name      | protocol          | models                   | priority |
      | openai   | OpenAI    | openai-compatible | gpt-4o,gpt-3.5          | 1        |
      | anthropic| Anthropic | anthropic         | claude-sonnet-4-20250514 | 1        |
    When I list all models
    Then there should be 3 models available
