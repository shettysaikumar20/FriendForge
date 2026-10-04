# Architecture

## Frontend

The existing React/Vite application composes Header, WelcomeSection, FileUpload, StudyMemory, StudyModes, ChatInterface and Quiz. AccessGate checks the backend session before rendering private study content. API requests use an optional public API base URL and include the session cookie. Backend credentials never enter Vite.

The active thread, notes-ready flag, chat and quiz live in React state. New Study Session resets these but not Backboard memory. Refreshing the browser also starts fresh session context. File uploads return a document ID; the UI polls the status endpoint and enables grounded study once indexed. Slow indexing can be rechecked without another upload.

## Dual AI Architecture: Online Study vs Local AI

FriendForge features two strictly separated AI operational modes:

### Mode 1 — Online Study (Hosted Backboard)
- **Flow**: `React -> Express -> Backboard Unified API -> OpenRouter -> meta-llama/llama-3.1-8b-instruct`
- **Requirements**: Internet connection required.
- **Capabilities**: Uploaded-note RAG indexing, document grounding, source provenance, multi-turn threads, persistent assistant Study Memory, interactive 5-question quizzes, and memory-prioritized revision.

### Mode 2 — Local AI (Ollama + Gemma 3 4B)
- **Flow**: `React -> Express -> http://127.0.0.1:11434 -> Ollama -> gemma3:4b`
- **Requirements**: Local Ollama runtime with `gemma3:4b` model installed. Once installed, internet is NOT required for AI generation.
- **Capabilities**: General study chat, step-by-step local explanations, bounded multi-turn conversation.
- **Provider Isolation**: Prompts in Local AI mode are strictly routed to localhost and NEVER sent to Backboard, OpenRouter, or any hosted API.
- **No Silent Fallback**: If Ollama is offline or Gemma is missing, the backend returns a clean 503 error rather than falling back to Backboard.
- **Explicit Non-Features**: Does not implement local RAG, local embeddings, or a vector database. Backboard RAG, notes upload, persistent memory, quiz workflow, and revise mode are disabled with clear UI indicators.

## Backend and model

Express owns credentialed operations. `backboardService.js` is the single Backboard-client factory and model configuration. The configured provider is OpenRouter and model is `meta-llama/llama-3.1-8b-instruct`. The SDK is pinned at 1.5.19. Per-turn system prompts control teaching style, source honesty and study mode. Returned model metadata takes precedence over configured fallback metadata.

## Threads and documents

`sendMessage` creates a thread when no thread ID is supplied. Upload creates one first if necessary, then calls `uploadDocumentToThread`. `getDocumentStatus` drives pending/processing/indexed/failed-or-error states. Documents are thread-scoped. A new study session needs new uploads; it does not delete the old Backboard resources.

A runtime document registry maps actual internal filenames/document IDs to original upload names within a thread. The UI displays only actual retrieved source filenames, with no invented pages or passages. Mapping survives server restarts on the persistent disk. The application does not retain uploaded file bytes locally after the request finishes.

## Persistent memory

Backboard memory is owned by the assistant, not by a thread. The dedicated assistant ID is loaded from the environment or created and persisted to an ignored runtime file. Backboard stores the memory itself; no local study database is used.

Application-side Llama extraction returns study-only subject/topic/status records. Validation limits field lengths and accepts only Needs practice, Reviewing or Strong. Backboard `addMemory`, `getMemories`, `updateMemory` and `deleteMemory` implement CRUD. Entries carry the `friendforge-study-v1` metadata marker. Automatic extraction is off. Explicitly reading and injecting normalized memory into each study turn makes cross-thread recall independent of thread history and automatic extraction timing.

Updates are serialized in this process and deduplicated by case-insensitive subject/topic. Memory failures produce warnings while ordinary chat can continue. Clearing deletes only tagged FriendForge records, requires explicit confirmation, and leaves chat/documents intact. Old thread history can still contain prior learning statements after memory clearing.

## Study modes

Explain uses a teaching prompt with examples, steps and a recap. Revise sorts saved topics by Needs practice, Reviewing, Strong and provides an empty state without calling the model if memory is empty.

Quiz obtains study facts in the study thread, then uses an isolated schema-only Llama turn to format five questions. Every question/options/answer/explanation field is validated. The model supplies the correct option text, which is validated against the choices and normalized to an index. One invalid-generation retry is allowed; invalid output is never sent as a usable quiz.

The backend withholds correct answers until each answer is submitted. Submission is sequential and idempotent. Final scoring groups evidence by topic with documented thresholds. Inconclusive results do not blindly overwrite an explicit status. Quiz state is bounded to 100 attempts, expires after one hour, and is lost on restart.

Backboard sometimes reuses conversation context without returning new retrieval metadata. A bounded in-process cache of actual previously retrieved response text can then supply quiz evidence. The API labels this as earlier retrieval. No source is fabricated. This is source provenance, not a guarantee of the model's factual accuracy.

## Production and security

One Node web service serves both the built React app and `/api`. A persistent disk stores the assistant identity and filename mapping; Backboard stores notes, threads and memory remotely. One instance is intended; local mutation locks, rate limits, cache and quiz state do not coordinate across replicas.

Production requires a private backend key and a shared study password of at least 16 characters. The password creates an eight-hour signed HttpOnly/Secure/SameSite=Strict cookie. The deployment uses HTTPS and one origin. Access is shared, not per-user. Password changes invalidate existing cookies. Health, model configuration and session status are public; study endpoints require the cookie. Exact-origin checks, input/upload limits, request throttling and sanitized errors reduce accidental exposure and cost abuse. No API key is logged or returned.

The persistent disk is needed for stable runtime identity/mappings unless a fixed assistant ID is supplied; the blueprint includes it. The memory data itself is in Backboard. Disk-backed single-instance deployment trades horizontal scaling and zero-downtime conveniences for a small, maintainable one-friend product.

## ElevenLabs Text-to-Speech Integration

FriendForge includes an isolated ElevenLabs Text-to-Speech integration designed as a study accessibility feature for students who prefer auditory learning and revision:

- **Explicit User Action**: Speech is never pre-generated or automatically synthesized for AI responses. Audio is generated only when the student explicitly clicks "Listen to Explanation" on an assistant message.
- **Cost & Quota Protection**: Client requests are rate-limited, length-bounded (max 3000 characters), and cached in the browser session. Replaying or resuming an explanation reuses the existing audio buffer without making redundant API requests.
- **Local AI Privacy Boundary**: Local AI mode operates strictly offline via Ollama. ElevenLabs voice playback is disabled in Local AI mode with an explicit notice (`Voice playback requires Online Study because ElevenLabs is a cloud service.`), ensuring local responses are never leaked to external cloud services.
- **Backend Architecture**: `POST /api/text-to-speech` handles speech synthesis in an isolated service (`elevenLabsService.js`). API keys remain strictly backend-only. Voice ID (`ELEVENLABS_VOICE_ID`, default: `21m00Tcm4TlvDq8ikWAM` / Rachel) and model (`ELEVENLABS_TTS_MODEL`, default: `eleven_multilingual_v2`) are server-controlled; clients cannot override credentials, endpoints, or voices. Upstream errors return sanitized application messages.

## Verification and limitations

See DEVELOPMENT_LOG.md for the phase-by-phase evidence and failures. A full real-service browser journey has passed. Model formatting and factual quality are nondeterministic; earlier runs required implementation fixes and retries. Automated tests do not substitute for the real friend test or a deployed Render smoke test. Live resource deletion follows Backboard's API semantics and is not a guarantee about provider backups or retention.
