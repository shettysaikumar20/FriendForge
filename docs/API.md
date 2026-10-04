# API

Base path: `/api`. JSON unless the upload route says otherwise. Production study endpoints require the signed shared-password cookie. Request Origin must be the same origin or in the configured exact allowlist. No endpoint returns the Backboard credential.

## Public endpoints

- `GET /api/health` → `{"status":"ok","service":"FriendForge API"}`. Process liveness only, not Backboard availability.
- `GET /api/config` → `{"model":{"name":"meta-llama/llama-3.1-8b-instruct","provider":"openrouter","openWeight":true}}`.
- `GET /api/session` → `{"success":true,"authenticated":true,"passwordRequired":true}` (booleans reflect the current session/config).
- `POST /api/session` with a JSON `password` string → `{"success":true}` plus signed session cookie. Incorrect password: 401. Ten unsuccessful attempts per IP in 15 minutes: 429. Do not log the request body.
- `DELETE /api/session` → clears the browser session cookie and returns `{"success":true}`.

## POST /api/chat

Request: `{"message":"Explain normalization","mode":"explain"}`. Optional `threadId` (UUID) and `hasDocuments` (boolean). Mode is `chat` or `explain`. Message must be nonempty and at most 6000 characters.

Response: success, content, threadId, assistantId, retrievedFiles (actual original filenames where mapped), model (provider/name/openWeight), usage (inputTokens/outputTokens/totalTokens), and optional memoryWarning. A memory warning means the response worked but extraction/read/write did not fully complete.

Omitting threadId starts a new thread under the persistent assistant. Existing thread IDs continue history.

## POST /api/documents/upload

Multipart form: one `document` file and optional `threadId`. Supported PDF/TXT only, nonempty, at most 10 MB. PDF signature is checked; TXT cannot contain NUL bytes. Extension and supplied MIME must be compatible with supported formats.

Response: `{"success":true,"threadId":"UUID","document":{"id":"UUID","name":"DBMS_Unit_3.pdf","status":"pending"}}`. An indexed status can also be returned immediately. Temporary file cleanup runs even when processing fails. A successful upload response does not by itself mean the document is indexed.

## GET /api/documents/:id/status

For documents registered by this installation. Response: success and document with id, name, threadId, status. Status is pending, processing, indexed, failed or error. Unknown local ID: 404. Poll until indexed; stop on failed/error. The frontend bounds its polling and provides a recheck button after a long wait.

## GET /api/memory

Returns `{"success":true,"memories":[{"id":"opaque-id","subject":"DBMS","topic":"Normalization","status":"Needs practice"}]}`. Only tagged, validated FriendForge study records are shown. Empty memory is an empty array, not demo data.

## DELETE /api/memory

Requires `{"confirm":true}`; otherwise 400. Returns `{"success":true}` after deleting the dedicated assistant's tagged FriendForge memories using verified Backboard deletion. Unrelated assistant memory, thread history and documents are not deleted. A partial remote failure returns an error; refresh and retry.

## POST /api/quiz

Request: `{"message":"Quiz me on normalization"}` plus optional threadId and hasDocuments. Generates five validated questions. Response includes success, threadId, model, retrievedFiles, sourceContext (`current` or `earlier`), and quiz:

```json
{"id":"opaque-quiz-id","total":5,"questions":[{"index":0,"question":"...","options":["A","B","C","D"]}]}
```

The actual response contains five questions. Correct answers and explanations are withheld. When notes are indicated, actual current or earlier retrieved evidence is required; otherwise generation fails safely. Malformed model output is regenerated once, then returns a student-readable 502 error. Earlier evidence means a previous actually retrieved response in this process, not a new retrieval or invented citation.

## POST /api/quiz/:id/answer

Request: `{"index":0,"option":1}`. Both are integer zero-based indices. Submit one question at a time. Options range from 0 to 3. Repeating the same submission returns the same result; changing an already submitted answer or skipping ahead returns 400.

Response includes success, correct (boolean), correctAnswer (index), explanation, source (actual filename array), and complete (boolean). The final answer also includes score, total, and memoryUpdated or memoryWarning. Unknown/expired/restarted quiz: 404. Quizzes expire after one hour or a server restart.

Per-topic progress: at least 4 questions and 80% correct → Strong; at least 2 wrong and below 50% correct → Needs practice; otherwise Reviewing. Topics with fewer than two questions are skipped. Reviewing preserves an existing explicit status.

## POST /api/revise

Optional threadId and hasDocuments. Chooses Needs practice first, then Reviewing, then Strong. Returns a chat-shaped result plus revisionTopic. With no memory, returns actionable empty-state content without an AI call.

## GET /api/local-ai/status

Public status check determining whether local Ollama and the configured model (`gemma3:4b`) are reachable.
Response:
```json
{
  "available": true,
  "provider": "ollama",
  "model": "gemma3:4b",
  "local": true
}
```
If Ollama is stopped or the model is missing, returns `{"available":false,"provider":"ollama","model":"gemma3:4b","local":true}` without throwing.

## POST /api/local-chat

Local AI inference endpoint routed strictly to Ollama (`http://127.0.0.1:11434/api/chat`). Completely isolated from Backboard and hosted APIs.
Request:
```json
{
  "message": "Explain database normalization in 3 simple points.",
  "messages": [
    { "role": "user", "content": "Explain normalization." },
    { "role": "assistant", "content": "..." }
  ]
}
```
Validation & Security:
- Requires non-empty string `message` or array of 1..15 messages with roles `user`, `assistant`, or `system`.
- Max message length: 6000 characters; total character limit: 24,000 characters.
- Rejects client-supplied `url`, `ollamaUrl`, or `model` overrides (400 Bad Request) to prevent arbitrary proxying.
- Slices conversation history to last 10 messages before dispatch.
- Returns normalized FriendForge response:
```json
{
  "success": true,
  "content": "...",
  "message": "...",
  "model": {
    "name": "gemma3:4b",
    "provider": "ollama",
    "openWeight": true,
    "local": true
  },
  "provider": "ollama",
  "local": true
}
```
- If Ollama fails, returns clean 503 (`{"success":false,"error":"Service Unavailable","message":"Local AI is unavailable. Make sure Ollama is running and gemma3:4b is installed."}`). NEVER silently falls back to Backboard or hosted APIs.
## POST /api/text-to-speech

Isolated ElevenLabs Text-to-Speech synthesis endpoint for spoken AI explanations. Triggered only upon explicit student click.

Request:
```json
{
  "text": "Database normalization helps organize data and reduce unnecessary duplication."
}
```

Validation & Security:
- `text`: Non-empty string, maximum 3000 characters.
- Rejects client overrides of `apiKey`, `xiApiKey`, `voiceId`, `model`, `url`, or `endpoint` with `400 Bad Request`.
- Rate-limited and protected by the session gate.
- Server-controlled voice configuration: `ELEVENLABS_VOICE_ID` (default: `21m00Tcm4TlvDq8ikWAM` / Rachel), `ELEVENLABS_TTS_MODEL` (default: `eleven_multilingual_v2`).
- Returns raw `audio/mpeg` (MP3) binary stream with `Content-Type: audio/mpeg` and `Cache-Control: no-store`.
- If ElevenLabs is unconfigured or upstream fails, returns sanitized `503 Service Unavailable` (`{"error":"Service Unavailable","message":"Audio generation is temporarily unavailable."}`) without exposing secrets or raw provider errors.

## Errors and limits

Errors contain a safe `message`; stack traces/provider error bodies are suppressed. 400 invalid input or upload; 401 sign-in needed; 403 disallowed Origin; 404 unknown resource/route; 413 oversized JSON; 429 request/password limit; 502 model/provider/validation failure; 503 service unavailable. JSON limit: 32 KB. Model/upload/answer/tts routes share a single-instance limit of 20 POST requests per minute and two concurrent requests. Health and memory polling do not consume model-request quota. Frontend prevents conflicting operations.

The recommended production deployment is same-origin. Cross-site cookie authentication is not supported by the Strict cookie; use the documented one-service deployment. The health endpoint remains available without credentials for Render checks.

