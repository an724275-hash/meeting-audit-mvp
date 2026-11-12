import assert from "node:assert/strict";
import worker from "../dist/server/index.js";

const origin = "https://example.test";
const health = await worker.fetch(new Request(`${origin}/api/health`));
assert.equal(health.status, 200);
assert.equal((await health.json()).local_available, false);

const page = await worker.fetch(new Request(origin));
assert.equal(page.status, 200);
assert.match(await page.text(), /Через OpenAI API/);

const missingKey = await worker.fetch(new Request(`${origin}/api/analyze`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "api", transcript: "Тестовый разговор длится больше двадцати символов." }),
}));
assert.equal(missingKey.status, 400);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.authorization, "Bearer test-key");
    assert.equal(JSON.parse(options.body).store, false);
    return Response.json({ output: [{ content: [{ type: "output_text", text: "# Итог\nХорошая встреча." }] }] });
  };
  const result = await worker.fetch(new Request(`${origin}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "api", api_key: "test-key", transcript: "Тестовый разговор длится больше двадцати символов." }),
  }));
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.match(data.report, /Хорошая встреча/);
  assert.match(data.html, /<h1>Итог<\/h1>/);
  assert.ok(!JSON.stringify(data).includes("test-key"));
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Worker checks passed");
