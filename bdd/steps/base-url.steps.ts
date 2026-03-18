import { expect } from "bun:test";
import { Given, Then, When } from "@deepracticex/bdd";
import { normalizeBaseUrl } from "../../packages/routerx/src/baseurl";

let inputUrl: string;
let protocol: string;
let result: string;

Given("a baseURL {string} for protocol {string}", (url: string, proto: string) => {
  inputUrl = url;
  protocol = proto;
});

When("the baseURL is normalized", () => {
  result = normalizeBaseUrl(inputUrl, protocol);
});

Then("the result should be {string}", (expected: string) => {
  expect(result).toBe(expected);
});
