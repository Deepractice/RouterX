/**
 * Local development server
 *
 * Usage: bun run dev
 */

import { serve } from "bun";
import { createRouterX } from "./app";

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_BASE_URL = process.env.ARK_BASE_URL;

if (!ARK_API_KEY || !ARK_BASE_URL) {
  console.error("Missing ARK_API_KEY or ARK_BASE_URL in environment");
  process.exit(1);
}

const app = createRouterX({
  router: {
    providers: [
      {
        id: "ark",
        name: "Volcengine Ark",
        protocol: "openai-compatible",
        apiKey: ARK_API_KEY,
        baseUrl: ARK_BASE_URL,
        models: [
          "deepseek-v3-2-251201",
          "deepseek-v3-250324",
          "deepseek-r1-250528",
          "doubao-1-5-pro-32k-250115",
          "doubao-1-5-lite-32k-250115",
          "doubao-seed-2-0-pro-260215",
          "doubao-seed-2-0-code-preview-260215",
          "glm-4-7-251222",
          "qwen3-32b-20250429",
        ],
        priority: 1,
      },
    ],
  },
});

const PORT = parseInt(process.env.PORT ?? "3700", 10);

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`RouterX running on http://localhost:${PORT}`);
console.log(`
Endpoints:
  POST /openai/v1/chat/completions   (OpenAI protocol)
  POST /anthropic/v1/messages        (Anthropic protocol)
  GET  /v1/models                    (list models)
  GET  /health                       (health check)
`);
