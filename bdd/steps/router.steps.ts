import { expect } from "bun:test";
import type { DataTable } from "@deepracticex/bdd";
import { Given, Then, When } from "@deepracticex/bdd";
import { Router } from "../../packages/core/src/router/Router";
import type { RegisteredProvider, RouteResult } from "../../packages/core/src/router/types";

let router: Router;
let routeResult: RouteResult | null;
let modelList: Array<{ model: string; providerId: string; protocol: string }>;

Given("the following providers are registered:", (dataTable: DataTable) => {
  const rows = dataTable.hashes();
  const providers: RegisteredProvider[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    protocol: row.protocol as RegisteredProvider["protocol"],
    apiKey: "test-key",
    models: row.models.split(",").map((m: string) => m.trim()),
    priority: parseInt(row.priority, 10),
    enabled: row.enabled === undefined ? true : row.enabled === "true",
  }));
  router = new Router({ providers });
});

Given("the default provider is {string}", (providerId: string) => {
  // Recreate router with default
  const currentProviders = (router as any).providers as RegisteredProvider[];
  router = new Router({ providers: currentProviders, defaultProviderId: providerId });
});

When("I route model {string}", (model: string) => {
  routeResult = router.route(model);
});

When("I list all models", () => {
  modelList = router.listModels();
});

Then("the route should match provider {string}", (providerId: string) => {
  expect(routeResult).not.toBeNull();
  expect(routeResult!.provider.id).toBe(providerId);
});

Then("the routed model should be {string}", (model: string) => {
  expect(routeResult).not.toBeNull();
  expect(routeResult!.model).toBe(model);
});

Then("the route should be null", () => {
  expect(routeResult).toBeNull();
});

Then("there should be {int} models available", (count: number) => {
  expect(modelList).toHaveLength(count);
});
