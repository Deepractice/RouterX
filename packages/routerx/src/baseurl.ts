/**
 * BaseURL normalization — each SDK expects a specific suffix
 */

export const PROTOCOL_BASE_SUFFIX: Record<string, string> = {
  "openai-compatible": "/v1",
  anthropic: "/v1",
};

export const PROTOCOL_DEFAULT_BASE: Record<string, string> = {
  "openai-compatible": "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

export function normalizeBaseUrl(baseUrl: string, protocol: string): string {
  const suffix = PROTOCOL_BASE_SUFFIX[protocol];
  if (!suffix) return baseUrl;
  const cleaned = baseUrl.replace(/\/+$/, "");
  if (cleaned.endsWith(suffix)) return cleaned;
  return cleaned + suffix;
}
