// unit-test.mjs — checks the Worker's logic WITHOUT a real model.
// It replaces env.AI with a fake ("mock") that returns fixed text.
// This proves the error handling and the source checks work.
// It does NOT prove answer quality — that needs the real model (run-tests.mjs).
//
// Usage: node scripts/unit-test.mjs

import assert from "node:assert/strict";
import worker from "../src/index.js";

// Build a fake env whose AI returns `reply`, or throws if reply is an Error.
const fakeEnv = (reply) => ({
  AI: {
    run: async () => {
      if (reply instanceof Error) throw reply;
      return { response: reply };
    },
  },
});

// Send a POST /api/ask to the Worker and return { status, data }.
async function ask(env, body) {
  const req = new Request("http://test/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await worker.fetch(req, env);
  return { status: res.status, data: await res.json() };
}

const tests = [
  ["answer with a valid source", async () => {
    const r = await ask(fakeEnv('{"found":true,"answer":"Select Mark complete.","sources":["DOC1"]}'), { question: "save progress?" });
    assert.equal(r.status, 200);
    assert.equal(r.data.found, true);
    assert.equal(r.data.sources[0].id, "DOC1");
  }],
  ["JSON wrapped in code fences is still parsed", async () => {
    const r = await ask(fakeEnv('```json\n{"found":true,"answer":"Tuesday 16:00 UTC.","sources":["doc2"]}\n```'), { question: "coaching?" });
    assert.equal(r.data.found, true);
    assert.equal(r.data.sources[0].id, "DOC2");
  }],
  ["model says not found", async () => {
    const r = await ask(fakeEnv('{"found":false,"answer":"","sources":[]}'), { question: "price?" });
    assert.equal(r.data.found, false);
    assert.match(r.data.answer, /not available in the supplied documents/);
  }],
  ["invented source is rejected", async () => {
    const r = await ask(fakeEnv('{"found":true,"answer":"It costs $50.","sources":["DOC9"]}'), { question: "price?" });
    assert.equal(r.data.found, false);
  }],
  ["answer without any source is rejected", async () => {
    const r = await ask(fakeEnv('{"found":true,"answer":"It costs $50.","sources":[]}'), { question: "price?" });
    assert.equal(r.data.found, false);
  }],
  ["non-JSON model output is not shown", async () => {
    const r = await ask(fakeEnv("Sure! The course costs $50."), { question: "price?" });
    assert.equal(r.data.found, false);
  }],
  ["model throws -> 503 with clear message", async () => {
    const r = await ask(fakeEnv(new Error("upstream 500")), { question: "anything" });
    assert.equal(r.status, 503);
    assert.equal(r.data.errorType, "MODEL_UNAVAILABLE");
  }],
  ["simulateFailure flag -> 503", async () => {
    const r = await ask(fakeEnv('{"found":true,"answer":"x","sources":["DOC1"]}'), { question: "q", simulateFailure: true });
    assert.equal(r.status, 503);
  }],
  ["SIMULATE_AI_FAILURE env var -> 503", async () => {
    const env = { ...fakeEnv('{"found":true,"answer":"x","sources":["DOC1"]}'), SIMULATE_AI_FAILURE: "true" };
    const r = await ask(env, { question: "q" });
    assert.equal(r.status, 503);
  }],
  ["missing AI binding -> 503", async () => {
    const r = await ask({}, { question: "q" });
    assert.equal(r.status, 503);
  }],
  ["empty question -> 400", async () => {
    const r = await ask(fakeEnv("{}"), { question: "   " });
    assert.equal(r.status, 400);
  }],
];

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log("PASS", name); }
  catch (e) { failed++; console.log("FAIL", name, "-", e.message); }
}
console.log(failed ? `\n${failed} test(s) failed` : `\nAll ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
