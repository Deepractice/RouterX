Feature: BaseURL Normalization
  Each protocol SDK expects a specific baseURL format.
  RouterX normalizes user-provided baseURLs to match SDK expectations.

  Scenario Outline: Normalize baseURL per protocol
    Given a baseURL "<input>" for protocol "<protocol>"
    When the baseURL is normalized
    Then the result should be "<expected>"

    Examples:
      | input                                     | protocol          | expected                                     |
      | https://ark.example.com/api/coding        | openai-compatible | https://ark.example.com/api/coding/v1        |
      | https://ark.example.com/api/coding/v1     | openai-compatible | https://ark.example.com/api/coding/v1        |
      | https://ark.example.com/api/coding/v1/    | openai-compatible | https://ark.example.com/api/coding/v1        |
      | https://ark.example.com/api/coding        | anthropic         | https://ark.example.com/api/coding/v1        |
      | https://ark.example.com/api/coding/v1     | anthropic         | https://ark.example.com/api/coding/v1        |
      | https://ark.example.com/api/coding/v1/    | anthropic         | https://ark.example.com/api/coding/v1        |
      | https://api.openai.com/v1                 | openai-compatible | https://api.openai.com/v1                    |
      | https://api.anthropic.com/v1              | anthropic         | https://api.anthropic.com/v1                 |
