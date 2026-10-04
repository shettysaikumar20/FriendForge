<div align="center">

# ⚡ FriendForge

### An AI Learning Companion — Learn. Practice. Remember. Revise.

**RAG remembers the material. Memory remembers the learner.**

<br/>

![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2026-FF6B35?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Gemma](https://img.shields.io/badge/Gemma_3-4B_Local_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Local_Inference-000000?style=for-the-badge)
![Render](https://img.shields.io/badge/Render-Deployment-46E3B7?style=for-the-badge&logo=render&logoColor=black)

<br/>

**Online Study ☁️ · Document RAG 📚 · Study Memory 🧠 · Quizzes 📝 · Voice 🔊 · Local AI 💻**

</div>

---

## ✨ What is FriendForge?

**FriendForge** is a personal AI learning companion built for the **Hacktoberfest 2026 — Build for a Friend Challenge**.

Instead of acting as just another chatbot, FriendForge combines learning material, contextual explanations, active recall, quizzes, revision, learner memory, voice accessibility, and optional local AI.

A learner can upload study material, ask questions about it, simplify difficult concepts, test understanding, revisit weak areas, and switch to a locally running open-weight model when hosted AI is not appropriate or internet connectivity is unavailable.

> **The goal isn't only to answer a question. It's to help the learner understand it, test it, and come back to what they haven't mastered yet.**

---

## 🌟 Key Features

| Feature | What it does |
|---|---|
| 📚 **PDF / TXT Notes** | Upload study material for note-grounded learning |
| 🔎 **RAG Q&A** | Retrieves relevant information from uploaded documents before answering |
| ✨ **Explain** | Breaks concepts into simpler explanations, examples, and recall prompts |
| 📝 **Quiz Me** | Generates validated multiple-choice quizzes and checks answers server-side |
| 🔄 **Revise** | Returns to topics that need additional practice |
| 🧠 **Study Memory** | Tracks topics as **Needs Practice**, **Reviewing**, or **Strong** |
| 🔊 **Voice Explanations** | Uses ElevenLabs TTS when explicitly requested |
| ☁️ **Online Study** | Full RAG, memory, quiz, revision, and voice workflow |
| 💻 **Local AI** | Runs Gemma 3 4B locally through Ollama |
| 🔐 **Capability Isolation** | Local mode does not silently fall back to hosted AI |
| 📱 **Responsive Interface** | Chat-first experience across desktop, tablet, and mobile layouts |
| 🛡️ **Production Access Gate** | Shared-password protection for the deployed study space |

---

# ☁️ Online Study vs 💻 Local AI

FriendForge deliberately provides **two different AI paths**.

They are not presented as equivalent. Each exists for a different purpose.

| Capability | ☁️ Online Study | 💻 Local AI |
|---|:---:|:---:|
| General learning questions | ✅ | ✅ |
| Explain mode | ✅ | ✅ |
| PDF/TXT note upload | ✅ | — |
| Document RAG | ✅ | — |
| Source-aware responses | ✅ | — |
| Quiz workflow | ✅ | — |
| Persistent Study Memory | ✅ | — |
| Weak-topic revision | ✅ | — |
| ElevenLabs voice | ✅ | — |
| Llama 3.1 8B Instruct | ✅ | — |
| Gemma 3 4B | — | ✅ |
| Ollama local inference | — | ✅ |
| Can perform AI inference without internet* | — | ✅ |
| Silent cloud fallback | — | ❌ |

\* After Ollama and the required Gemma model have already been installed locally.

> **Important:** FriendForge does not claim that the entire application has identical functionality offline. Local AI is intentionally a smaller, isolated experience for general learning conversations.

---

# 🏗️ Architecture

FriendForge maintains a clear boundary between hosted and local inference.

## ☁️ Online Study

```text
                         ┌─────────────────────┐
                         │       Learner       │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    React + Vite     │
                         │      Frontend       │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Node.js + Express  │
                         │       Backend       │
                         └──────┬────────┬─────┘
                                │        │
                  ┌─────────────┘        └──────────────┐
                  ▼                                     ▼
        ┌──────────────────┐                  ┌──────────────────┐
        │    Backboard     │                  │    ElevenLabs    │
        │                  │                  │       TTS        │
        └────────┬─────────┘                  └──────────────────┘
                 │
        ┌────────┼─────────────┐
        ▼        ▼             ▼
   Documents   Memory      Model Routing
      RAG                       │
                                ▼
                    Llama 3.1 8B Instruct
```

Uploaded documents remain scoped to their study thread, while learner-memory records belong to the dedicated FriendForge assistant.

---

## 💻 Local AI

```text
             ┌─────────────────────┐
             │       Learner       │
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │     FriendForge     │
             │   Local Frontend    │
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │   Express Backend   │
             └──────────┬──────────┘
                        │ localhost
                        ▼
             ┌─────────────────────┐
             │       Ollama        │
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │     Gemma 3 4B      │
             │  Open-weight Model  │
             └─────────────────────┘
```

Local responses are generated through Ollama at `127.0.0.1:11434`.

There is **no hosted-model fallback** if local inference is unavailable.

---

# 📚 RAG Remembers the Material.
# 🧠 Memory Remembers the Learner.

These are deliberately separate concepts inside FriendForge.

### 📚 Retrieval-Augmented Generation

RAG answers:

> **“What does my learning material say?”**

Uploaded documents are associated with a Backboard study thread. FriendForge retrieves relevant document context and uses it to ground answers.

When retrieval provides source metadata, FriendForge can display the corresponding source filename.

### 🧠 Study Memory

Study Memory answers:

> **“What does this learner need to practice?”**

FriendForge maintains structured learning records such as:

```text
Subject: Database Management Systems
Topic: Normalization
Status: Needs Practice
```

The learner can start a fresh study session without treating every previous chat message as permanent context.

### 📝 Quiz

Quiz mode turns learning into active recall rather than passive reading.

FriendForge separates evidence retrieval from quiz formatting and validates generated quiz structure before presenting it.

### 🔄 Revise

Revision uses the learner's saved study state to focus attention on areas that still require practice.

---

# 🔊 Voice Explanations

FriendForge integrates **ElevenLabs Text-to-Speech** into Online Study.

Voice generation is intentionally **user-triggered**.

The learner chooses:

> 🔊 **Listen to Explanation**

FriendForge then sends the selected assistant response to the backend, which requests speech generation from ElevenLabs.

This design:

- avoids unnecessary TTS requests,
- reduces redundant API usage,
- gives the learner control over when content leaves the application for speech generation,
- and keeps cloud TTS completely disabled in Local AI mode.

---

# 💎 Local AI with Gemma 3

FriendForge supports **Gemma 3 4B** as an optional local open-weight model through Ollama.

```text
Model: gemma3:4b
Runtime: Ollama
Inference: Local machine
```

Once the model is installed, Local AI can answer general learning questions without depending on the hosted Backboard/OpenRouter inference path.

Local inference comes with a real engineering trade-off:

> **Hosted inference is typically faster, while local inference provides greater independence from connectivity and remote inference infrastructure.**

On lower-powered CPU hardware, Gemma responses can take noticeably longer than hosted model responses.

FriendForge exposes that trade-off rather than hiding it.

---

# 🧰 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 |
| **Build Tool** | Vite 7 |
| **Backend** | Node.js + Express 4 |
| **Language** | JavaScript |
| **File Uploads** | Multer |
| **Hosted AI Infrastructure** | Backboard |
| **Hosted Model** | Llama 3.1 8B Instruct |
| **Hosted Model Provider** | OpenRouter through Backboard |
| **Document Retrieval** | Backboard Documents / RAG |
| **Learner Memory** | Backboard Assistant Memory |
| **Local AI Model** | Gemma 3 4B |
| **Local Runtime** | Ollama |
| **Voice AI** | ElevenLabs |
| **Deployment** | Render |
| **Backend Testing** | Node.js Test Runner |
| **Browser Testing** | Playwright |
| **Version Control** | Git + GitHub |

---

# 🛡️ Reliability Engineering

FriendForge was tested against more than just successful model responses.

Development exposed real AI failure modes, including:

### RAG boundary failure

A model could correctly recognize that information was absent from uploaded notes but then continue by answering from general knowledge.

FriendForge's RAG instructions were strengthened so note-constrained questions do not silently turn into unsupported general-knowledge answers.

### Internal retrieval terminology

Generated answers could expose implementation-oriented retrieval language.

Regression coverage was added around this behavior.

### Local capability hallucination

During testing, Local Gemma incorrectly claimed that it was using uploaded study notes.

That was incorrect: Local AI has no access to Online Study documents or Backboard memory.

FriendForge now gives the local model an explicit capability boundary describing what it can and cannot access.

> These safeguards reduce known failure modes; they do **not** claim to eliminate model hallucinations completely.

---

# 🔐 Privacy & Capability Boundaries

FriendForge keeps the hosted and local paths deliberately separate.

## Online Study

Online Study sends relevant data through the FriendForge backend to hosted services.

Depending on the feature, this can include:

- Backboard
- the configured hosted model provider
- ElevenLabs when voice is explicitly requested

Uploaded documents and persistent Study Memory are Online Study features.

## Local AI

Local AI communicates with Ollama running on the same computer.

Local AI:

- ✅ Uses Gemma through local Ollama
- ✅ Supports general learning conversations
- ❌ Does not access Backboard
- ❌ Does not access Online Study documents
- ❌ Does not access persistent Backboard Study Memory
- ❌ Does not call ElevenLabs
- ❌ Does not silently switch to hosted AI

If Ollama is unavailable, FriendForge returns an error instead of secretly sending the request to a cloud model.

---

# 🔑 Security

FriendForge keeps private service credentials on the backend.

Never expose credentials through frontend `VITE_*` variables.

The repository excludes private `.env` files through `.gitignore`.

Production also supports a shared study-space password through:

```env
APP_PASSWORD=
```

The password gate prevents casual public access to a deployed FriendForge instance.

> FriendForge currently provides one shared study space rather than separate user accounts.

---

# 🚀 Running FriendForge Locally

## Prerequisites

Install:

- Node.js
- npm
- Git

Optional for Local AI:

- Ollama
- Gemma 3 4B

---

## 1. Clone the repository

```bash
git clone https://github.com/shettysaikumar20/FriendForge.git
cd FriendForge
```

---

## 2. Configure the backend

```bash
cd backend
npm ci
```

Create a private environment file from the example:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Linux / macOS

```bash
cp .env.example .env
```

Fill in the required private credentials.

**Never commit `.env`.**

Start the backend:

```bash
npm run dev
```

---

## 3. Start the frontend

Open another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite.

The development server proxies `/api` requests to the Express backend.

---

# 💻 Optional Ollama + Gemma Setup

Install Ollama separately for your operating system.

Then pull Gemma:

```bash
ollama pull gemma3:4b
```

Verify that it exists:

```bash
ollama list
```

You can also test it directly:

```bash
ollama run gemma3:4b
```

FriendForge expects the default local Ollama endpoint:

```text
http://127.0.0.1:11434
```

Switch FriendForge to **Local AI** and it will check whether the local runtime is available.

---

# ⚙️ Environment Variables

| Variable | Purpose |
|---|---|
| `BACKBOARD_API_KEY` | Backend credential for Online Study |
| `BACKBOARD_ASSISTANT_ID` | Optional fixed Backboard assistant for persistent study memory |
| `ELEVENLABS_API_KEY` | Backend-only ElevenLabs credential |
| `ELEVENLABS_VOICE_ID` | Optional voice selection |
| `ELEVENLABS_TTS_MODEL` | Optional ElevenLabs TTS model |
| `APP_PASSWORD` | Shared production study-space password |
| `OLLAMA_URL` | Local Ollama endpoint |
| `OLLAMA_MODEL` | Local model identifier |
| `PORT` | Backend listening port |
| `NODE_ENV` | Runtime environment |
| `NODE_VERSION` | Node runtime selection |
| `FRONTEND_URL` | Optional allowed frontend origins |
| `VITE_API_BASE_URL` | Optional public API origin |

Use the repository's `.env.example` files as the configuration reference.

**Never commit real credentials.**

---

# 🧪 Testing

FriendForge includes automated tests across the major application boundaries.

## Backend

```bash
cd backend
npm test
```

Additional integration/live validation scripts include:

```bash
npm run test:local:live
npm run test:tts:live
npm run test:live
npm run audit:secrets
```

Some live tests make real external model/service calls and should therefore be run intentionally.

## Frontend

```bash
cd frontend
npm test
npm run build
```

The project also uses Playwright for browser-level workflow validation.

Testing covers areas including:

- API behavior
- document workflows
- RAG boundaries
- learner memory
- study modes
- Local AI isolation
- TTS validation
- browser workflows
- production builds
- secret auditing

---

# 🌐 Deployment

FriendForge includes a root-level:

```text
render.yaml
```

for deployment through **Render**.

The hosted Render deployment is designed primarily for **Online Study**.

Production secrets are supplied through Render environment variables rather than committed to GitHub.

Typical production configuration requires:

```env
BACKBOARD_API_KEY=
ELEVENLABS_API_KEY=
APP_PASSWORD=
```

### Important Local AI distinction

A hosted Render service cannot access Ollama running at:

```text
localhost:11434
```

on a user's personal laptop.

Therefore:

- ☁️ **Render** hosts the Online Study experience.
- 💻 **Local FriendForge + Ollama** provides the Local AI experience.

This boundary is intentional.

---

# 📸 Screenshots & Demo

> Screenshots and final demo media will be added here.

<!--
Recommended additions:
1. FriendForge main interface
2. Note-grounded Online Study response
3. Quiz / Study Memory workflow
4. ElevenLabs voice controls
5. Local AI running Gemma 3 4B
6. Render deployment
-->

---

# 🏆 Hacktoberfest 2026

FriendForge was created for the:

### **Build for a Friend — Hacktoberfest 2026 Weekend Challenge**

The project combines genuinely used technologies including:

### 💎 Gemma
Gemma 3 4B provides optional local open-weight inference through Ollama.

### 🧠 Backboard
Backboard powers hosted model access, document retrieval, study threads, and persistent learner memory.

### 🔊 ElevenLabs
ElevenLabs provides explicit, on-demand voice explanations in Online Study.

### ☁️ Render
Render provides the hosted FriendForge web application environment.

---

# 🌍 Why Open Innovation Matters

AI applications do not have to depend on one model or one execution environment.

FriendForge demonstrates both ends of that spectrum.

### Hosted inference

Provides faster responses and supports the complete Online Study workflow.

### Local open-weight inference

Gemma 3 4B can run through Ollama directly on consumer hardware.

That provides another option when connectivity, deployment control, experimentation, or local execution matters.

Local inference also introduces trade-offs.

Smaller consumer hardware can be significantly slower than hosted infrastructure, and FriendForge's Local AI intentionally provides fewer features than Online Study.

But the important architectural capability remains:

> **The application can choose where inference happens instead of being permanently tied to one remote model API.**

---

# ⚠️ Current Limitations

FriendForge is intentionally transparent about its current boundaries.

- Online Study requires internet connectivity.
- Local AI does not currently provide uploaded-document RAG.
- Local AI does not use persistent Backboard Study Memory.
- ElevenLabs voice requires Online Study.
- Local CPU inference may be significantly slower than hosted inference.
- A hosted Render instance cannot connect to Ollama running on a user's laptop.
- FriendForge currently provides a shared study space rather than individual user accounts.
- Generated AI answers can still be incorrect and should be checked against learning material when accuracy matters.

---

# 🗺️ Future Improvements

Potential future directions include:

- 📚 Local document RAG
- ⚡ Faster local-model inference
- 📝 Additional quiz formats
- 📊 Learning-progress analytics
- 🎯 More advanced adaptive revision
- ♿ Additional accessibility improvements
- 👥 Separate learner profiles
- 🔊 Optional local text-to-speech
- 🧠 Expanded local learning memory

---

# 📖 Documentation

More technical documentation is available in:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/API.md`](docs/API.md)
- [`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

# 👨‍💻 Author

## Sai Kumar Shetty

**B.Tech — Information Technology**

[![GitHub](https://img.shields.io/badge/GitHub-shettysaikumar20-181717?style=for-the-badge&logo=github)](https://github.com/shettysaikumar20)

---

<div align="center">

### ⚡ FriendForge

**Learn → Understand → Practice → Remember → Revise**

Built with open-weight AI, thoughtful capability boundaries, and a focus on making learning more useful.

If you find FriendForge interesting, consider giving the repository a ⭐.

**Feedback and contributions are welcome.**

</div>
