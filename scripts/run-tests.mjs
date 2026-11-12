// run-tests.mjs — runs the 3 required test cases against a running Worker
// and saves the results to results/test-results.json and results/test-results.md
//
// Usage:
//   node scripts/run-tests.mjs                          (local: http://localhost:8787)
//   node scripts/run-tests.mjs https://your-worker.workers.dev   (deployed)

import { writeFile, mkdir } from "node:fs/promises";

const BASE_URL = (process.argv[2] || "http://localhost:8787").replace(/\/$/, "");

// The three cases the test asks for.
const CASES = [
  {
    name: "1. Question the documents answer",
    body: { question: "How do I save my progress after a lesson?" },
    expect: "found = true, source = Document 1",
  },
  {
    name: "2. Question the documents do NOT answer",
    body: { question: "How much does the Foundations course cost?" },
    expect: "found = false, 'not available' message, refer to support",
  },
  {
    name: "3. Model / API failure (simulated)",
    body: { question: "When is the group coaching session?", simulateFailure: true },
    expect: "HTTP 503, clear 'temporarily unavailable' message",
  },
];

const results = [];

for (const c of CASES) {
  const started = Date.now();
  let status, data;
  try {
    const res = await fetch(`${BASE_URL}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c.body),
    });
    status = res.status;
    data = await res.json();
  } catch (err) {
    status = "NETWORK_ERROR";
    data = { error: err.message };
  }
  results.push({ ...c, status, ms: Date.now() - started, response: data });
  console.log(`\n${c.name}\n  HTTP ${status}\n  ${JSON.stringify(data)}`);
}

// Save JSON (exact) and Markdown (easy to read in the README / walkthrough).
await mkdir("results", { recursive: true });
const stamp = new Date().toISOString();
await writeFile(
  "results/test-results.json",
  JSON.stringify({ runAt: stamp, baseUrl: BASE_URL, results }, null, 2)
);

const md = [
  `# Test results`,
  ``,
  `Run at ${stamp} against \`${BASE_URL}\``,
  ...results.flatMap((r) => [
    ``,
    `## ${r.name}`,
    `- Question: ${r.body.question}`,
    `- Expected: ${r.expect}`,
    `- HTTP status: ${r.status} (${r.ms} ms)`,
    `- Answer / error: ${r.response.answer || r.response.error}`,
    `- Sources: ${(r.response.sources || []).map((s) => s.title).join("; ") || "none"}`,
  ]),
].join("\n");
await writeFile("results/test-results.md", md + "\n");

console.log("\nSaved results/test-results.json and results/test-results.md");
