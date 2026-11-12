# Test results

Run at 2026-11-12T15:58:08.610Z against `http://localhost:8787`

## 1. Question the documents answer
- Question: How do I save my progress after a lesson?
- Expected: found = true, source = Document 1
- HTTP status: 200 (755 ms)
- Answer / error: To save your progress, select Mark complete after finishing a lesson.
- Sources: Document 1 — Getting started

## 2. Question the documents do NOT answer
- Question: How much does the Foundations course cost?
- Expected: found = false, 'not available' message, refer to support
- HTTP status: 200 (457 ms)
- Answer / error: Sorry, that information is not available in the supplied documents. Please contact support at support@brightpath.example (Monday to Friday, 09:00–17:00 UTC).
- Sources: none

## 3. Model / API failure (simulated)
- Question: When is the group coaching session?
- Expected: HTTP 503, clear 'temporarily unavailable' message
- HTTP status: 503 (12 ms)
- Answer / error: The AI assistant is temporarily unavailable. Please try again in a few minutes. If it is urgent, contact support@brightpath.example.
- Sources: none
