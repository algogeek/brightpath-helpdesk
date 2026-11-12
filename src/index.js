// index.js — BrightPath help desk (Cloudflare Worker)
//
// What this Worker does:
//   GET  /          -> serves a small web page with a question box
//   POST /api/ask   -> receives { question }, asks the language model,
//                      returns an answer + the document(s) that support it
//
// Design decisions (kept small on purpose):
//   - The 3 documents are tiny, so we send ALL of them to the model in the
//     prompt. No vector database or embeddings are needed at this size.
//   - The model must reply in JSON: { found, answer, sources }.
//   - We do NOT blindly trust the model: the code checks that every cited
//     source really exists. If nothing valid is cited, we answer
//     "not in the documents" instead of showing an unsupported answer.
//   - The model runs on Cloudflare Workers AI through a "binding" (env.AI).
//     A binding is configured in wrangler.jsonc, so there is NO API key in
//     the code or in the repository.

import { DOCUMENTS, DOCS_BY_ID } from "./documents.js";
import { PAGE_HTML } from "./page.js";

// Default model. Can be changed without touching code (see wrangler.jsonc "vars").
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

// If the model takes longer than this, we stop waiting and show an error.
const MODEL_TIMEOUT_MS = 20000;

// Max question length, to avoid abuse and huge prompts.
const MAX_QUESTION_CHARS = 500;

// Fixed text used whenever the documents do not contain the answer.
// Written by us, not by the model, so it is always the same and always safe.
const NOT_FOUND_MESSAGE =
  "Sorry, that information is not available in the supplied documents. " +
  "Please contact support at support@brightpath.example " +
  "(Monday to Friday, 09:00–17:00 UTC).";

// ---------------------------------------------------------------------------
// 1. Entry point: Cloudflare calls fetch() for every HTTP request.
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The web page
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(PAGE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // The API
    if (url.pathname === "/api/ask") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Use POST with a JSON body: { \"question\": \"...\" }" }, 405);
      }
      return handleAsk(request, env);
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};

// ---------------------------------------------------------------------------
// 2. Handle one question.
// ---------------------------------------------------------------------------
async function handleAsk(request, env) {
  // 2a. Read and validate the input.
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "The request body must be valid JSON." }, 400);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return json({ ok: false, error: "Please type a question." }, 400);
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return json({ ok: false, error: `Please keep the question under ${MAX_QUESTION_CHARS} characters.` }, 400);
  }

  // 2b. Failure test switch.
  // Two ways to simulate "the model is unavailable":
  //   - per request:  { "question": "...", "simulateFailure": true }
  //   - whole Worker: set the variable SIMULATE_AI_FAILURE="true"
  const simulateFailure =
    body.simulateFailure === true || env.SIMULATE_AI_FAILURE === "true";

  const model = env.AI_MODEL || DEFAULT_MODEL;

  // 2c. Call the model. Any problem here becomes a clear 503 message.
  let raw;
  try {
    raw = await callModel(env, model, question, simulateFailure);
  } catch (err) {
    // Log the technical detail for the developer (visible in Cloudflare logs)...
    console.error("Model call failed:", err && err.message);
    // ...but show the user a short, clear message.
    return json(
      {
        ok: false,
        error:
          "The AI assistant is temporarily unavailable. Please try again in a few minutes. " +
          "If it is urgent, contact support@brightpath.example.",
        errorType: "MODEL_UNAVAILABLE",
      },
      503
    );
  }

  // 2d. Turn the model's text into a checked, safe answer.
  const result = interpretModelOutput(raw);
  return json({ ok: true, model, ...result });
}

// ---------------------------------------------------------------------------
// 3. Call Workers AI (with timeout and failure simulation).
// ---------------------------------------------------------------------------
async function callModel(env, model, question, simulateFailure) {
  if (simulateFailure) {
    throw new Error("Simulated failure (failure test switch is on)");
  }
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("AI binding is missing. Check the 'ai' section in wrangler.jsonc");
  }

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: question },
  ];

  // Promise.race: whichever finishes first wins — the model or the timer.
  const response = await Promise.race([
    env.AI.run(model, { messages, max_tokens: 400, temperature: 0 }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${MODEL_TIMEOUT_MS} ms`)), MODEL_TIMEOUT_MS)
    ),
  ]);

  // Workers AI text models return { response: "..." }.
  // Some models may already return parsed JSON in "response", so accept both.
  const text = response && response.response;
  if (text == null || text === "") {
    throw new Error("The model returned an empty response");
  }
  return text;
}

// ---------------------------------------------------------------------------
// 4. The instructions for the model.
// ---------------------------------------------------------------------------
function buildSystemPrompt() {
  // Put every document in the prompt, each one labelled with its id.
  const docsBlock = DOCUMENTS.map(
    (d) => `[${d.id}] ${d.title}\n${d.text}`
  ).join("\n\n");

  return `You are the help desk assistant for BrightPath Learn.
Answer ONLY with information found in the documents below. Do not use outside knowledge. Do not guess.

Rules:
- If the documents answer the question, write a short answer (1-3 sentences) and list the id of every document you used.
- If the documents do NOT answer the question (for example pricing, refunds or job placement), set "found" to false.
- Never ask the member to send a password.
- Reply with JSON only, no other text, in exactly this shape:
{"found": true or false, "answer": "your answer", "sources": ["DOC1"]}

DOCUMENTS:
${docsBlock}`;
}

// ---------------------------------------------------------------------------
// 5. Check the model's output before showing it.
// ---------------------------------------------------------------------------
export function interpretModelOutput(raw) {
  const parsed = parseJsonLoosely(raw);

  // If the model did not return usable JSON, we refuse to show free text,
  // because we could not verify which document supports it.
  if (!parsed) {
    return { found: false, answer: NOT_FOUND_MESSAGE, sources: [], note: "Model output was not valid JSON" };
  }

  // Keep only sources that really exist (DOC1, DOC2, DOC3). Remove duplicates.
  const citedIds = Array.isArray(parsed.sources) ? parsed.sources : [];
  const validIds = [...new Set(citedIds.map((s) => String(s).trim().toUpperCase()))].filter(
    (id) => DOCS_BY_ID[id]
  );

  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";

  // Grounding rule: an answer counts as "found" only if the model said so,
  // gave some text, AND cited at least one real document.
  const found = parsed.found === true && answer.length > 0 && validIds.length > 0;

  if (!found) {
    return { found: false, answer: NOT_FOUND_MESSAGE, sources: [] };
  }

  return {
    found: true,
    answer,
    sources: validIds.map((id) => ({ id, title: DOCS_BY_ID[id].title })),
  };
}

// Small models sometimes wrap JSON in ```code fences``` or add a sentence
// before it. This pulls out the first {...} block and parses it.
function parseJsonLoosely(raw) {
  if (raw && typeof raw === "object") return raw; // already parsed
  const text = String(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Helper: send a JSON response with the right header.
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
