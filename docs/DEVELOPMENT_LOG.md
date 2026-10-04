# Development log

## Phase 4 ? persistent study memory

Architecture: Backboard assistant-owned memory, with application-side structured extraction using the same open-weight Llama model. Automatic extraction is disabled (memory: off); only validated subject/topic/status records with FriendForge metadata are stored. Each chat explicitly receives the current normalized memory. Thread history is not the persistence mechanism.

Verified against installed backboard-sdk 1.5.19 client.d.ts and client.js: createAssistant, sendMessage (assistant_id, thread_id, system_prompt, memory, json_output), getMemories, addMemory, updateMemory, deleteMemory. CRUD responses are normalized by the SDK. Assistant identity is saved in ignored backend/data/assistant.json; production must configure BACKBOARD_ASSISTANT_ID so redeploys keep the same memory owner.

Official references checked 2026-10-02:
- https://docs.backboard.io/sdk/memory
- https://docs.backboard.io/api-reference/memories/add
- https://docs.backboard.io/api-reference/memories/update
- https://docs.backboard.io/sdk/assistants

Memory supports create, read, update and delete. It survives new threads under the same assistant. Backboard also offers automatic extraction; FriendForge deliberately uses explicit structured extraction to limit what it saves. No primitive keyword extractor is used.

UI: removed mock cards; loading, empty, populated, error and retry states; refresh after chat; failed extraction is visible rather than silently claiming persistence.

Validation: 2 unit tests passed; production frontend build passed. Live integration test pending completion. PowerShell blocks npm.ps1 on this machine; use npm.cmd.

Phase 4 exit: PASS ? 3 automated tests, frontend build, live create/update/clear, distinct-thread recall, normal chat/context/model, RAG unique code and missing-information regression. Secret-value scan found zero copies outside environment files. Live tests use and delete an isolated assistant.

## Phase 5 ? study modes

Explain uses a per-turn teaching prompt on the existing thread. Quiz requests exactly five multiple-choice questions with JSON output; backend validates all question/options/answer/explanation fields and suppresses the answer key until submission. In-memory quiz state expires after one hour or a server restart. Answer submission is sequential and idempotent. Sources are actual retrieval metadata, never model-invented page references.

Quiz mastery is grouped by subject/topic: at least 4 questions and 80% correct = Strong; at least 2 wrong and below 50% correct = Needs practice; otherwise Reviewing. Single-question topics do not change memory. Inconclusive Reviewing does not replace an existing explicit status. Revise selects Needs practice, then Reviewing, then Strong; no memory returns actionable guidance without a model call.

Initial validation: schema/answer withholding/threshold tests and frontend build passed. Live mode tests pending.

Phase 5 reliability finding: provider json_output mode repeatedly produced malformed quiz JSON (extra opening brace, invalid answer index). Quiz now uses explicit JSON prompting and full backend validation, with one bounded regeneration attempt. Invalid quizzes are never shown. Structured extraction still uses its independently passing JSON mode. Grounding means retrieved document context was available; model answer accuracy is not mathematically guaranteed.

Quiz answer representation: model supplies exact correct option text, backend validates membership and converts it to an index. This avoids one-based/zero-based model confusion. The full regression also encountered a transient memory service failure; the application returned the intended memory warning. Service availability and probabilistic model output remain external limitations.

Phase 5 exit: 9 automated tests PASS; frontend build PASS; live Explain PASS; final isolated quiz generation/scoring/explanations/memory/revision PASS. Quiz retrieval and JSON formatting are separate model turns; hidden answers never enter the study conversation. Earlier full regressions exercised chat/thread/RAG/memory successfully but hit probabilistic quiz failures. Invalid model output remains a handled retry condition, documented rather than treated as valid.

## Phase 6 ? intelligence, UX and reliability

Document uploads now return an actual pending/indexed status and a separate status endpoint drives polling. Both SDK 'failed' and documented 'error' terminal states are handled. Slow indexing offers a status retry without another upload. Original filenames are mapped from actual retrieved internal names within the owning thread, with safe basename fallback and no invented citations. Mapping persists in an ignored runtime JSON file.

Backend validates file extension/MIME, PDF signature, nonempty TXT/PDF, 10 MB limit, message length, thread ID shape and JSON payload size. Raw service errors no longer reach the client. Frontend upload/chat/quiz requests lock conflicting controls. Prompts teach simply and distinguish missing note information. Privacy and AI fallibility notes added.

Browser tests passed at 390, 768 and 1440 pixels with mocked API lifecycle plus memory retry/unsupported upload. Keyboard-accessible upload button, named chat input, radio groups, aria-live feedback, focus rings, reduced-motion styles, long-text wrapping and contrast improvements added. Production frontend build passed. Real Backboard browser journey pending.

Phase 6 live browser results so far: TXT and PDF indexing, grounded Q&A with original filename, and Explain PASS. Model quiz formatting failures were correctly rejected; formatter now runs with an isolated schema-only prompt, without the teaching prompt or memory context. Four Playwright tests completed with exit code 0 after granting process cleanup outside the sandbox.

Phase 6 exit: PASS ? complete real Backboard browser journey (TXT + PDF ? indexed ? grounded question/original filenames ? Explain ? five-question quiz/score ? memory update ? Revise), mobile overflow assertion, 12 backend tests, four browser regressions and production build. Earlier failed runs and model variability are retained above. Quiz may explicitly reuse earlier actual retrieved evidence; it never labels it as a new retrieval.

## Phase 7 ? friend testing preparation

Removed the invented student name and greeting. Added concise onboarding and a clearly labeled demo-notes download. New Study Session resets chat, quiz, mode and document context while preserving assistant memory. Clear study memory offers a separate destructive confirmation and cancellation. docs/FRIEND_TEST_CHECKLIST.md contains a 10?15 minute real-user test and untouched feedback placeholders. No human feedback was created. Validation pending.

Phase 7 exit: PASS — 12 backend tests, four browser journeys including reset/cancel/clear at three widths, and frontend build. Real friend testing remains manual; no feedback was invented.

## Phase 8 — production access and security

Production startup requires BACKBOARD_API_KEY and an APP_PASSWORD of at least 16 characters; the server exits immediately if either is missing in production mode. A signed HttpOnly/Secure/SameSite=Strict cookie gates study endpoints after password verification, with timing-safe comparison and IP-based rate limiting (10 attempts per 15 minutes). Health, config and session-status endpoints remain public for Render health checks and initial page load.

Security headers: X-Content-Type-Options, Referrer-Policy, X-Frame-Options (DENY). Production CSP locks down script/style/font/connect sources to self plus Google Fonts. Exact-origin CORS blocks untrusted cross-origin requests (403). x-powered-by is disabled. JSON body limit is 32 KB. Upload limit is 10 MB with extension/MIME/signature validation. Model/upload routes share a process-level rate limit of 20 POST requests per minute and 2 concurrent requests. Error responses suppress stack traces and provider error details.

Render blueprint (render.yaml): single Node web service, 0.5c-512mb plan, build command installs and builds both packages, start command runs Express, health check at /api/health, auto-deploy off, 1 GB persistent disk at /var/data/friendforge for assistant identity and filename mapping. Environment variables documented in README and DEPLOYMENT.md; only BACKBOARD_API_KEY and APP_PASSWORD are secrets, never logged or returned.

Access test (access.test.js): production gate with random 48-character password, verifies health is public, memory requires auth, untrusted origin is 403, wrong password is 401, correct password sets a secure cookie, tampered cookie fails, config does not leak the password, root serves HTML, and /.env is 404. All assertions passed against a local production server.

Secret-value scanner (security-audit.js) checks the entire repo for credential values outside .env. Frontend source scan for forbidden VITE_BACKBOARD_API_KEY. Dependency audits (npm audit) run clean on both packages. .gitignore covers node_modules, dist, .env, uploads, temp, data, .npm-cache, test-results, and playwright-report.

Documentation: README, ARCHITECTURE.md, API.md, DEPLOYMENT.md, DEVELOPMENT_LOG.md, and FRIEND_TEST_CHECKLIST.md all verified to contain no API keys, passwords, fake deployed URLs, or invented friend feedback. DEPLOYMENT.md provides exact Render service type, build/start commands, environment variable names, persistent disk configuration, health check path, and post-deployment smoke tests.

Phase 8 exit: PASS — production access gate, security headers, CORS, rate limiting, secret scanning, dependency audits, deployment documentation, and .gitignore all verified. Git repository initialized; no secrets in tracked files. The project is ready for the owner to deploy on Render and publish on GitHub.
