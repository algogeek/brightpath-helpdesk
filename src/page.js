// page.js — the small web page served at "/".
// Plain HTML + a few lines of JavaScript. No framework, no build step.
// All text from the server is inserted with textContent (never innerHTML),
// so a malicious answer cannot inject HTML or scripts into the page.

export const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BrightPath Help Desk</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; line-height: 1.5; color: #1f2937; }
    h1 { font-size: 1.4rem; margin-bottom: 4px; }
    p.sub { color: #6b7280; margin-top: 0; }
    textarea { width: 100%; box-sizing: border-box; font: inherit; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; }
    button { margin-top: 8px; padding: 10px 18px; font: inherit; border: 0; border-radius: 8px; background: #2563eb; color: #fff; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    label.fail { display: block; margin-top: 8px; color: #6b7280; font-size: .9rem; }
    .box { margin-top: 20px; padding: 14px; border-radius: 8px; }
    .ok { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .missing { background: #fefce8; border: 1px solid #fde68a; }
    .error { background: #fef2f2; border: 1px solid #fecaca; }
    .sources { margin-top: 8px; font-size: .9rem; color: #374151; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <h1>BrightPath Help Desk</h1>
  <p class="sub">Ask a question. Answers come only from the three BrightPath documents.</p>

  <textarea id="q" rows="3" maxlength="500" placeholder="e.g. How do I save my lesson progress?"></textarea>
  <button id="ask">Ask</button>
  <label class="fail"><input type="checkbox" id="fail"> Simulate model failure (for testing)</label>

  <div id="out" class="box hidden">
    <div id="answer"></div>
    <div id="sources" class="sources"></div>
  </div>

<script>
  const btn = document.getElementById("ask");
  const out = document.getElementById("out");
  const answerEl = document.getElementById("answer");
  const sourcesEl = document.getElementById("sources");

  function show(kind, text, sources) {
    out.className = "box " + kind;          // ok | missing | error
    answerEl.textContent = text;
    sourcesEl.textContent = sources || "";
  }

  btn.addEventListener("click", async () => {
    const question = document.getElementById("q").value.trim();
    if (!question) { show("error", "Please type a question."); return; }

    btn.disabled = true;
    show("missing", "Thinking…");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, simulateFailure: document.getElementById("fail").checked })
      });
      const data = await res.json();

      if (!data.ok) {
        show("error", data.error || "Something went wrong.");
      } else if (data.found) {
        show("ok", data.answer, "Source: " + data.sources.map(s => s.title).join("; "));
      } else {
        show("missing", data.answer, "Source: not found in the supplied documents");
      }
    } catch (e) {
      // Network down, server unreachable, etc.
      show("error", "Could not reach the help desk. Check your connection and try again.");
    } finally {
      btn.disabled = false;
    }
  });
</script>
</body>
</html>`;
