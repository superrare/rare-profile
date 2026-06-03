import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSuccess, renderError, classifyError } from "../src/cli/output.js";

test("renderSuccess JSON shape", () => {
  const out = renderSuccess("whoami", { id: "u1" }, { json: true, human: () => "ignored" });
  assert.deepEqual(JSON.parse(out), { ok: true, command: "whoami", data: { id: "u1" } });
});

test("renderSuccess human uses the provided formatter", () => {
  const out = renderSuccess("whoami", { id: "u1" }, { json: false, human: (d) => `id=${(d as { id: string }).id}` });
  assert.equal(out, "id=u1");
});

test("renderError JSON shape includes code and status", () => {
  const out = renderError("buy", { code: "out_of_scope", message: "nope", status: 403 }, { json: true });
  assert.deepEqual(JSON.parse(out), { ok: false, command: "buy", error: { code: "out_of_scope", message: "nope", status: 403 } });
});

test("renderError human is a plain message", () => {
  const out = renderError("buy", { code: "out_of_scope", message: "nope", status: 403 }, { json: false });
  assert.match(out, /nope/);
});

test("classifyError maps ProfileAuthError to auth_required + exit 3", () => {
  const e = Object.assign(new Error("Not authenticated."), { name: "ProfileAuthError" });
  const { shape, exitCode } = classifyError(e);
  assert.equal(shape.code, "auth_required");
  assert.equal(exitCode, 3);
});

test("classifyError maps ProfileApiError to api_error + exit 1 and carries status", () => {
  const e = Object.assign(new Error("403 thing"), { name: "ProfileApiError", status: 403 });
  const { shape, exitCode } = classifyError(e);
  assert.equal(shape.code, "api_error");
  assert.equal(shape.status, 403);
  assert.equal(exitCode, 1);
});
