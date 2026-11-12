# BrightPath Help Desk

A small AI help desk that answers questions **only** from the three fictional BrightPath Learn documents.
Built with **Cloudflare Workers** and **Workers AI** (free tier, no paid provider).

## What it does

| Requirement | How it is met |
|---|---|
| Type a question, get an answer | Web page at `/` and JSON API at `POST /api/ask` |
| Use the documents as the source | All 3 documents are sent to the model with ids `DOC1`–`DOC3` |
| Show which document supports the answer | The response lists the cited document(s); the code rejects ids that do not exist |
| Say so when the answer is missing | Fixed "not available in the supplied documents" message, written by the code, not the model |
| Real language model | `@cf/meta/llama-3.1-8b-instruct-fast` on Workers AI (changeable in `wrangler.jsonc`) |
| No API keys in code | Workers AI is reached through a binding; auth comes from `wrangler login` |
| Clear message on model/API failure | HTTP 503 + "temporarily unavailable" message; 20 s timeout |
| Simple way to test failure | Checkbox on the page, `"simulateFailure": true` in the API, or `SIMULATE_AI_FAILURE="true"` |

## Project structure

```
src/index.js          Worker: routing, model call, error handling, answer checks
src/documents.js      The three supplied documents (fictional data only)
src/page.js           The web page (plain HTML + JS)
scripts/unit-test.mjs Logic tests with a mocked model (no account needed)
scripts/run-tests.mjs The 3 required cases against a running Worker; saves results/
wrangler.jsonc        Cloudflare configuration
```

## How it works

1. The user's question and the 3 documents go to the model in one prompt.
2. The model must reply in JSON: `{ "found": true/false, "answer": "...", "sources": ["DOC1"] }`.
3. The code checks the reply. An answer is shown **only if** `found` is true, there is text, and at least one **real** document id is cited. Otherwise the user gets the standard "not available" message.
4. Any model error, timeout or missing binding returns a clear 503 message. Technical details go to the logs only.

The documents are tiny, so a vector database or embeddings would add complexity without benefit.

## Run it locally

Requirements: Node.js 18+ and a free Cloudflare account.

```bash
npm install
npx wrangler login        # opens the browser once
npm run dev               # http://localhost:8787
```

Note: Workers AI always runs on Cloudflare, even in local dev, so `wrangler login` is required.
It uses the free daily allocation.

## Tests

```bash
npm run test:unit                         # logic tests with a mocked model (no login needed)
npm run test:cases                        # 3 required cases against http://localhost:8787
npm run test:cases -- https://<your-worker>.workers.dev   # against the deployed demo
```

Results are saved in `results/test-results.json` and `results/test-results.md`.

## Deploy (optional)

```bash
npm run deploy
```

## Test results

Run locally against the real model (`@cf/meta/llama-3.1-8b-instruct-fast`) with `npm run test:cases`.
Full output: [`results/test-results.md`](results/test-results.md) and [`results/test-results.json`](results/test-results.json).

| # | Case | Question | HTTP | Result |
|---|---|---|---|---|
| 1 | Answered by the documents | How do I save my progress after a lesson? | 200 | "To save your progress, select Mark complete after finishing a lesson." — Source: Document 1 — Getting started |
| 2 | Not answered by the documents | How much does the Foundations course cost? | 200 | `found: false`, no sources. "Sorry, that information is not available in the supplied documents. Please contact support…" |
| 3 | Model / API failure (simulated) | When is the group coaching session? (`simulateFailure: true`) | 503 | "The AI assistant is temporarily unavailable. Please try again in a few minutes…" (`MODEL_UNAVAILABLE`) |

All three behave as expected: the answer matches Document 1 word for word, no price is invented, and the failure shows a clear message with no technical details.

## What I would improve

**Automatic answer-quality checks.** Today the code verifies *that* a real document is cited, not *that* the cited document really contains the answer.
Next step: a small evaluation set (questions + expected document) run on every change, plus a check that key words in the answer appear in the cited document.

## Tools used

<!-- Be specific and honest, e.g.: Claude (Anthropic) helped draft the code and README; I reviewed, ran and tested it. -->
