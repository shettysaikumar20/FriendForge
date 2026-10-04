# FriendForge

An AI study companion built for a friend.

## The Problem

Lecture notes are useful, but turning them into understandable explanations, practice questions, and a revision plan takes time. Students can also lose track of what they still need to practice between study sessions.

## Who I Built It For

FriendForge is designed for one college friend who wants help studying from their own notes. Their identity and personal details are intentionally omitted. Real testing and feedback are still to be completed.

## What FriendForge Does

Upload a PDF or TXT file, ask a question, select Explain for a simpler walkthrough, complete a five-question quiz, and use Revise to revisit saved weak topics. Start a new study session without losing study memory.

## Features

- Dual AI Modes: **Online Study** (Backboard hosted Llama 3.1 8B) and **Local AI** (Ollama Gemma 3 4B on localhost).
- Voice Accessibility: Optional **ElevenLabs Text-to-Speech** ("Listen to Explanation") in Online Study mode, triggered only by explicit user action.
- PDF/TXT upload, up to 10 MB, with uploading/indexing/ready/failure states (Online mode).
- Backboard RAG and source filenames from actual retrieval metadata (Online mode).
- Explain mode with examples, steps and active recall (supported in both modes).
- Validated interactive multiple-choice quizzes with server-side answer checking, explanations and scores (Online mode).
- Persistent study memory: subject, topic, Needs practice / Reviewing / Strong (Online mode).
- Memory-aware revision, fresh sessions, and confirmed memory clearing.
- Open-weight Llama 3.1 8B Instruct through Backboard, and Gemma 3 4B through Ollama.
- Offline inference capable in Local AI mode once Gemma is installed.
- Responsive UI, keyboard controls, clear empty/error states, and a shared-password production gate.

These features have automated and live integration coverage. Model output is probabilistic: invalid quizzes are rejected after a bounded retry, and generated answers still need checking against notes. A complete live browser journey passed; earlier runs also exposed intermittent model and service failures. See [development evidence](docs/DEVELOPMENT_LOG.md).

## Architecture

FriendForge supports two distinct, isolated operational paths:

```text
[MODE 1: Online Study]
React → Express → Backboard Unified API → Llama 3.1 8B Instruct (OpenRouter)
PDF/TXT → Express → Backboard Thread Documents → RAG → grounded response
Learning statement → Llama structured extraction → Backboard assistant memory
Explicit click → Express → ElevenLabs Text-to-Speech API → Spoken explanation audio

[MODE 2: Local AI]
React → Express → http://127.0.0.1:11434 → Ollama → Gemma 3 4B (gemma3:4b)
Offline-capable local inference • Bounded multi-turn context • Isolated from Backboard
ElevenLabs disabled locally so local responses are NEVER sent to a cloud service
```

React and Express remain separate source projects. Production uses one Render Node web service: Express serves the built Vite app and the API under one origin. No separate database is required.

## Open Innovation

FriendForge uses the open-weight model `meta-llama/llama-3.1-8b-instruct`, not a proprietary-only model. The centralized service makes experimenting with other supported models possible, although each replacement needs prompt, quality, metadata and retrieval testing. Open weights offer additional deployment and experimentation choices; this app currently uses hosted inference and is not an offline or self-hosted system. Backboard is the managed integration service, not something this project claims is open-source.

## Backboard Integration

The pinned `backboard-sdk` version is 1.5.19. One backend client handles model routing, thread continuation, document upload/status, and persistent memory CRUD. Thread documents stay scoped to their study session. Memory belongs to a dedicated assistant, so it survives a new thread.

Study extraction is application-side, using the same Llama model and a strict schema. Backboard automatic memory extraction is off; only validated study records are explicitly stored. Quiz generation separates retrieval from JSON formatting. If Backboard does not retrieve again, a previously retrieved response can supply evidence; its sources are labeled as earlier retrieval.

Verified references: [memory](https://docs.backboard.io/sdk/memory), [documents](https://docs.backboard.io/sdk/documents), and [assistants](https://docs.backboard.io/sdk/assistants), plus the installed SDK types/source.

## Tech Stack

React 18, Vite 7, JavaScript, Node.js, Express 4, Multer, Backboard SDK, Node's test runner, and Playwright. Node 24 is the deployment target; local verification ran on Node 26.7.0. Supported Node engines are declared in both packages.

## Running Locally

Use Node 24 and two terminals. On Windows PowerShell with restricted script execution, use `npm.cmd` in place of `npm`.

```sh
cd backend
npm ci
```

Copy `backend/.env.example` to `backend/.env` if you do not already have a private environment file. Fill in the backend credential privately. Do not overwrite an existing `.env`. Then:

```sh
npm run dev
```

In the second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. The development proxy connects `/api` to Express. There is no frontend credential. The optional shared study password enables the local gate too.

### Local AI Setup (Optional)

FriendForge supports running Gemma 3 4B locally via Ollama. Ollama is not bundled with FriendForge and must be installed independently on the machine:

```sh
# Pull the Gemma 3 4B model
ollama pull gemma3:4b

# Confirm the model is available
ollama list
```

Once installed, ensure Ollama is running (`http://127.0.0.1:11434`). FriendForge will automatically detect its availability via `GET /api/local-ai/status` when switching to **Local AI** mode. Note: on an 8 GB laptop running CPU inference without discrete GPU acceleration, generating multi-point responses may take ~1–2 minutes. The backend timeout is configured for 180 seconds to accommodate local CPU inference.

For a local production build, run `npm run build` in `frontend`, then `npm start` in `backend`. Express serves that build. Production mode requires a backend key and a shared password of at least 16 characters. Use HTTPS in production.

## Environment Variables

| Name | Purpose |
| --- | --- |
| `BACKBOARD_API_KEY` | Private backend credential for Online Study mode. |
| `BACKBOARD_ASSISTANT_ID` | Optional fixed owner for persistent study memory. |
| `ELEVENLABS_API_KEY` | Backend-only API key for ElevenLabs Text-to-Speech. |
| `ELEVENLABS_VOICE_ID` | Server voice selection (default: `21m00Tcm4TlvDq8ikWAM` / Rachel). |
| `ELEVENLABS_TTS_MODEL` | ElevenLabs TTS model (default: `eleven_multilingual_v2`). |
| `APP_PASSWORD` | Private shared study-space password; required in production. |
| `OLLAMA_URL` | Local Ollama base URL (default: `http://127.0.0.1:11434`). |
| `OLLAMA_MODEL` | Local Ollama model identifier (default: `gemma3:4b`). |
| `PORT` | Backend listen port, provided by Render. |
| `NODE_ENV` | Runtime mode. |
| `NODE_VERSION` | Render Node runtime selection. |
| `FRONTEND_URL` | Optional comma-separated exact allowed frontend origins. |
| `DATA_DIR` | Persistent runtime directory for assistant identity and filename mapping. |
| `VITE_API_BASE_URL` | Optional public API origin; leave unset for the recommended one-origin deployment. |

Do not put private values in Vite variables, source files, screenshots, commits or documentation.

## Testing

In `backend`:

```sh
npm test
npm run test:local:live
npm run test:tts:live
npm run test:live
npm run audit:secrets
```

In `frontend`:

```sh
npm test
npm run build
```

Browser tests use installed Microsoft Edge by default on Windows; set `PLAYWRIGHT_CHANNEL` to use another installed channel. On Linux, install Playwright Chromium and leave the channel unset. Live tests use the existing backend environment, make paid model calls, create an isolated test assistant, and delete that test assistant on completion. Run `npm run test:browser:live` in `backend` after building `frontend` for the real API/browser journey. Synthetic TXT/PDF fixtures are in `backend/test/fixtures`.

## Privacy and Limitations

In **Online Study** mode: notes, chat messages and study extraction requests are sent through the FriendForge backend to Backboard and its model provider (OpenRouter). Saved study records live in Backboard. Voice playback uses ElevenLabs Text-to-Speech only when the student explicitly clicks "Listen to Explanation"; audio is generated on-demand and cached in session memory to prevent redundant requests and quota consumption. Clearing memory deletes FriendForge's tagged study records; it does not erase existing chat history or uploaded documents. New Study Session resets local session context, not remote data.

In **Local AI** mode: AI responses are generated by Gemma through Ollama running on this computer (`http://127.0.0.1:11434`). Prompts are kept strictly local to localhost and are NEVER sent to Backboard, OpenRouter, or external servers. ElevenLabs voice playback is disabled in Local AI mode so local responses are never sent to an external cloud service. If Ollama fails, the application returns a clean error without falling back to hosted AI. Uploaded-note RAG and persistent Backboard memory are disabled in Local AI mode. Only Local AI inference is offline-capable once the model is installed; the application does not make the broad claim that the entire system is offline.

This is one shared study space, not separate accounts. The production password prevents casual public access but anyone given it shares the same memory. Quiz attempts and retrieval-context cache are in process memory and disappear on restart; quizzes also expire after one hour. The persistent disk retains assistant identity and original filename mappings. An assistant-ID override must refer to the intended dedicated assistant.

Quiz progress updates require enough questions per topic: at least four with 80% correct for Strong; at least two wrong and below 50% correct for Needs practice. Otherwise Reviewing. Single-question topics are skipped, and inconclusive Reviewing does not overwrite an existing explicit status.

## Friend Testing

Tester: [TO BE COMPLETED AFTER REAL TEST]

Useful: [TO BE COMPLETED]

Confusing: [TO BE COMPLETED]

Requested improvement: [TO BE COMPLETED]

Change made: [TO BE COMPLETED]

Use the [10–15 minute checklist](docs/FRIEND_TEST_CHECKLIST.md). No human feedback has been invented.

## Deployment

[Exact Render and GitHub steps](docs/DEPLOYMENT.md) accompany `render.yaml`. The configuration uses a paid web service and a small persistent disk; confirm available credits and pricing in your account. Automatic deployment is disabled in the blueprint. No service, deployed URL, GitHub push, or challenge submission has been created by the coding agent.

## Hacktoberfest 2026

Prepared for the user's intended DEV “Build for a Friend” challenge project. The real friend test, final eligibility/rules check, repository publication, deployment and challenge submission remain owner actions. This README is project documentation, not a fabricated submission or testimonial.

Further reading: [Architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [Development log](docs/DEVELOPMENT_LOG.md).
