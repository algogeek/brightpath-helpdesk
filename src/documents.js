// documents.js
// The three fictional documents supplied by the test (BrightPath Learn).
// They are copied word for word from the test page. No other data is used.
//
// Each document has:
//   id    -> short code the model must return to cite its source
//   title -> human-readable name shown to the user
//   text  -> the document content

export const DOCUMENTS = [
  {
    id: "DOC1",
    title: "Document 1 — Getting started",
    text: `Platform: BrightPath Learn (fictional).
After joining, open Home and select Start Lesson 1: Set your goal.
The Foundations course has 6 lessons. Lessons can be watched in any order.
To save your progress, select Mark complete after finishing a lesson. Watching a video alone does not mark the lesson complete.
Your next lesson appears on Home.`,
  },
  {
    id: "DOC2",
    title: "Document 2 — Coaching and feedback",
    text: `Platform: BrightPath Learn (fictional).
A group coaching session takes place every Tuesday at 16:00 UTC.
The link appears on the Coaching page 30 minutes before the session.
Recordings are added to the Coaching page within 24 hours.
To get feedback on practice work, paste a shareable link in the Practice page and select Request feedback.
Feedback usually arrives within 2 working days. This is a typical response time, not a guarantee.`,
  },
  {
    id: "DOC3",
    title: "Document 3 — Account help",
    text: `Platform: BrightPath Learn (fictional).
To reset a password, select Forgot password on the sign-in page.
For a missing course or incorrect lesson progress, contact support@brightpath.example and include the account email and lesson name.
Support is available Monday to Friday, 09:00–17:00 UTC.
This document does not contain pricing, refund rules or job placement promises. For those questions, say the information is not available in the supplied documents and refer the member to support.
Never ask a member to send a password.`,
  },
];

// Quick lookup: "DOC2" -> document object. Used to validate citations.
export const DOCS_BY_ID = Object.fromEntries(DOCUMENTS.map((d) => [d.id, d]));
