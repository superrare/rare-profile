import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BASE_URL, resolveBaseUrl } from "../src/cli/base-url.js";

test("base URL defaults to the Studio origin", () => {
  assert.equal(DEFAULT_BASE_URL, "https://studio.superrare.com");
  assert.equal(resolveBaseUrl({}), DEFAULT_BASE_URL);
});

test("stored legacy default migrates with or without one trailing slash", () => {
  for (const configuredBaseUrl of ["https://beta.rare.xyz", "https://beta.rare.xyz/"]) {
    assert.equal(resolveBaseUrl({ configuredBaseUrl }), DEFAULT_BASE_URL);
  }
});

test("explicit base URL has highest precedence", () => {
  assert.equal(
    resolveBaseUrl({
      explicitBaseUrl: "https://override.example",
      configuredBaseUrl: "https://beta.rare.xyz",
    }),
    "https://override.example",
  );
  assert.equal(
    resolveBaseUrl({
      explicitBaseUrl: "https://beta.rare.xyz",
      configuredBaseUrl: "https://custom.example",
    }),
    "https://beta.rare.xyz",
  );
});

test("arbitrary configured URLs are preserved exactly", () => {
  for (const configuredBaseUrl of [
    "https://custom.example",
    "https://custom.example/",
    "https://beta.rare.xyz/path",
    "https://beta.rare.xyz//",
  ]) {
    assert.equal(resolveBaseUrl({ configuredBaseUrl }), configuredBaseUrl);
  }
});
