import { configure } from "@deepracticex/bdd";

await configure({
  features: ["bdd/features/**/*.feature"],
  steps: ["bdd/support/**/*.ts", "bdd/steps/**/*.ts"],
  tags: "@e2e",
  timeout: 30_000,
});
