# Deployment

## Overview

FriendForge runs as a single Node.js web service on Render. Express serves both the built React frontend and the `/api` backend under one origin. No separate database is required; Backboard stores threads, documents, and study memory remotely. A small persistent disk preserves runtime identity (assistant ID) and original filename mappings across restarts.

## Prerequisites

- A Render account with enough credits for a web service with a persistent disk.
- A Backboard API key (from your Backboard dashboard).
- A shared study password of at least 16 characters.
- Git and Node.js 24+ installed locally.

## Render deployment

### 1. Push the repository to GitHub

```sh
git init
git add -A
git commit -m "FriendForge v1.0"
git remote add origin https://github.com/YOUR_USERNAME/friendforge.git
git push -u origin main
```

### 2. Create the service from the blueprint

- Go to **Render Dashboard → New → Blueprint**.
- Connect the repository. Render reads `render.yaml`.
- Review the service settings and confirm.

Alternatively, create a **Web Service** manually with the settings below.

### 3. Configure environment variables in Render

| Variable | Where to set | Notes |
| --- | --- | --- |
| `BACKBOARD_API_KEY` | Render secret | Your private Backboard credential. |
| `APP_PASSWORD` | Render secret | Shared study password, ≥ 16 characters. |
| `NODE_ENV` | In `render.yaml` | Already set to `production`. |
| `NODE_VERSION` | In `render.yaml` | Already set to `24`. |
| `DATA_DIR` | In `render.yaml` | Already set to `/var/data/friendforge`. |
| `PORT` | Render-provided | Automatically injected by Render. |

Do not set `FRONTEND_URL` for the recommended one-origin deployment. Do not set `VITE_API_BASE_URL`.

### 4. Render service settings

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime | Node |
| Plan | 0.5c-512mb (or higher) |
| Build command | `npm --prefix backend ci && npm --prefix frontend ci --include=dev && npm --prefix frontend run build` |
| Start command | `npm --prefix backend start` |
| Health check path | `/api/health` |
| Auto-deploy | Off (manual deploy recommended) |

### 5. Persistent disk

| Setting | Value |
| --- | --- |
| Name | friendforge-state |
| Mount path | `/var/data/friendforge` |
| Size | 1 GB |

The disk stores `assistant.json` (assistant identity) and `documents.json` (original filename mappings). If you override `BACKBOARD_ASSISTANT_ID` with a known value, the disk is only needed for filename mappings. Without the disk, a new assistant is created on each deploy, disconnecting from existing study memory.

### 6. Post-deployment smoke tests

After the first deploy completes and the health check passes:

1. `GET https://YOUR_URL/api/health` → `{"status":"ok","service":"FriendForge API"}`
2. `GET https://YOUR_URL/api/config` → confirms `meta-llama/llama-3.1-8b-instruct` and `openrouter`
3. Open the root URL in a browser → password gate should appear
4. Sign in with the shared password → study workspace loads
5. Upload a small TXT or PDF → status goes to "Indexed and ready"
6. Ask a question about the uploaded notes → response cites the original filename
7. Generate a quiz → five questions appear, answers work
8. Check Study Memory → entries appear after quiz or explicit learning statements
9. Start New Study Session → chat resets, memory stays
10. Lock study space → returns to password gate

### 7. Backboard assistant identity

On the first run, FriendForge creates a dedicated Backboard assistant and saves its ID to `DATA_DIR/assistant.json`. All study memory belongs to this assistant. To keep memory across full redeployments (including disk recreation), copy the assistant ID from the data file and set `BACKBOARD_ASSISTANT_ID` in Render's environment. Otherwise, the persistent disk preserves it automatically.

## Limitations

- Single-instance deployment. Quiz state, rate limits, and in-process caches do not coordinate across replicas.
- Restarting clears in-process quiz attempts and rate limit windows.
- The persistent disk is needed for stable identity unless `BACKBOARD_ASSISTANT_ID` is set.
- The shared password protects the space but does not isolate users. Anyone with the password shares one memory.
- Backboard handles document storage and memory persistence; Render only stores the identity/mapping files.

## HTTPS and cookies

Render provides HTTPS by default. The session cookie is HttpOnly, Secure, and SameSite=Strict. The production CSP header restricts script, style, font, and connection sources. Cross-origin deployment is not supported by the Strict cookie configuration; use the one-origin setup.

## Costs

The `render.yaml` blueprint uses a paid web service plan (0.5c-512mb) and a 1 GB persistent disk. Check current Render pricing and your available credits before deploying. Each study interaction uses Backboard API credits and OpenRouter model inference; monitor usage in both dashboards.
