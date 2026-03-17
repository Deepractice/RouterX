import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@routerxjs/core", "hono", "ai", "@ai-sdk/openai-compatible", "@ai-sdk/anthropic"],
});
