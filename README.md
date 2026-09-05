<div align="center">

# Forge

**An AI pair programmer inside a real editor.**

Describe a change in plain English, watch Forge edit your actual Next.js files,
and run the result live in the browser — with a diff for every change and
one-click undo for the whole turn.

[![CI](https://github.com/arhamgill/ai-code-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/arhamgill/ai-code-editor/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000?logo=express&logoColor=white)
![Postgres](https://img.shields.io/badge/Postgres-16-4169e1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-118-3fb950)

</div>

---

## What it does

Forge is a browser-based editor for Next.js projects with an agent wired into
the filesystem. You give it an instruction; it reads the files it needs, writes
complete files back, and streams every step as it happens. Nothing is
copy-pasted — the agent edits your project directly, and you review the diff.

The app you're building runs in the same tab. Forge boots a
[WebContainer](https://webcontainers.io), runs a real `npm install` and
`next dev`, and hot-reloads as files change. No local toolchain, no deploy step.

```
┌──────────────┬────────────────────────────┬───────────────┬──────────────┐
│  Explorer    │  Monaco editor + tabs      │  Live preview │  Assistant   │
│              │                            │               │              │
│  app/        │  export default function   │  ┌──────────┐ │  ▸ read      │
│   ├ page.tsx │    Home() {                │  │  your    │ │    page.tsx  │
│   └ about/   │      return <main>…        │  │  app,    │ │  ▸ write     │
│  components/ │    }                       │  │  running │ │    about/…   │
│              │                            │  └──────────┘ │  +42 −3 diff │
└──────────────┴────────────────────────────┴───────────────┴──────────────┘
```

## Features

| | |
|---|---|
| **Agentic editing** | Tool-calling loop over `read_file`, `write_file`, `delete_file`, `search_files`, `list_files`, streamed over SSE with live progress |
| **Live preview** | Real Node runtime in the browser via WebContainers — `npm install`, `next dev`, hot reload |
| **Checkpoints** | Every file is snapshotted *before* the agent touches it; one click rolls the whole turn back, including files you never opened |
| **Line-accurate diffs** | LCS-based diff with unified and split views, per-file revert |
| **Persistent chat** | Conversations and their checkpoints live in Postgres, not `localStorage` |
| **Keyboard-first** | Command palette, fuzzy file finder, tab cycling, full shortcut layer |
| **Light & dark** | One token system, no flash on load, `prefers-color-scheme` aware |
| **Responsive** | Three panes on desktop, a single-pane switcher on small screens |

## Stack

**Frontend** — Next.js 16 (App Router) · TypeScript · Tailwind v4 · Monaco ·
zustand · WebContainers · Clerk

**Backend** — Express · Prisma · PostgreSQL · Groq · zod · Helmet ·
`express-rate-limit`

**Quality** — Vitest (102 unit tests) · Playwright (16 e2e) · ESLint ·
GitHub Actions · Docker

---

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database ([Neon](https://neon.tech) works well and has a free tier)
- A [Clerk](https://dashboard.clerk.com) application
- A [Groq](https://console.groq.com/keys) API key

### Setup

```bash
git clone https://github.com/arhamgill/ai-code-editor.git
cd ai-code-editor

cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
# fill in DATABASE_URL, CLERK_*, GROQ_API_KEY

npm run setup   # installs everything, generates the Prisma client, migrates
npm run dev     # API on :5000, web on :3000
```

Open <http://localhost:3000>, sign up, and pick a template.

### With Docker

```bash
cp .env.docker.example .env   # fill in Clerk + Groq keys
docker compose up --build
```

Brings up Postgres, runs migrations, and serves the API and web app.

---

## Configuration

### `backend/.env`

| Variable | Required | Default | Purpose |
|---|:-:|---|---|
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | ✓ | — | Verifies session tokens |
| `GROQ_API_KEY` | ✓ | — | The agent's model provider |
| `PORT` | | `5000` | API port |
| `CORS_ORIGINS` | | `http://localhost:3000` | Comma-separated allowlist |
| `STORAGE_DIR` | | `./storage/users` | Where project files are written |
| `AGENT_MAX_STEPS` | | `12` | Tool-call ceiling per turn |
| `AGENT_RATE_LIMIT_PER_MIN` | | `15` | AI requests per account per minute |

Every value is validated at boot — a missing or malformed variable fails fast
with a readable message instead of a confusing 500 on the first request.

### `frontend/.env.local`

| Variable | Required | Purpose |
|---|:-:|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | Clerk client key |
| `CLERK_SECRET_KEY` | ✓ | Server-side session verification |
| `NEXT_PUBLIC_API_URL` | | Defaults to `http://localhost:5000` |

---

## Architecture

```
                      ┌───────────────────────────────┐
  browser ────────────│  Next.js 16 (App Router)      │
                      │  Monaco · zustand · Tailwind  │
                      │  WebContainer (npm + next dev)│
                      └───────────┬───────────────────┘
                        Clerk JWT │ REST + SSE
                      ┌───────────▼───────────────────┐
                      │  Express API                  │
                      │  zod · helmet · rate limits   │
                      │  ┌──────────┬───────────────┐ │
                      │  │ projects │ agent runner  │ │
                      │  │ chats    │ checkpoints   │ │
                      │  └────┬─────┴───────┬───────┘ │
                      └───────┼─────────────┼─────────┘
                              │             │
                     ┌────────▼───┐  ┌──────▼──────┐
                     │ PostgreSQL │  │ Groq API    │
                     │ (Prisma)   │  │ (streaming) │
                     └────────────┘  └─────────────┘
                              │
                     ┌────────▼──────────────────────┐
                     │ storage/users/<uid>/<project>/│
                     └───────────────────────────────┘
```

### Layout

```
backend/
  prisma/           schema + versioned migrations
  src/
    agent/          model registry, prompt, tools, streaming runner
    lib/            path sandboxing, workspace fs, diff, SSE, checkpoints
    middleware/     auth (+ user provisioning), rate limits
    routes/         projects, chats, agent, health
frontend/src/
  app/              routes: landing, projects, workspace, auth
  components/
    ui/             button, modal, popover, toast, primitives
    workspace/      explorer, tabs, editor, chat, preview, palette, diff
  lib/              api client, SSE reader, diff, stores, hooks
e2e/                Playwright specs
```

### How a turn works

1. The client `POST`s to `/api/agent/stream`; the request is validated **before**
   the stream opens, so a bad request is an ordinary JSON error rather than an
   error event on a committed `200`.
2. The runner makes **one** streaming call per step, accumulating text and
   tool-call deltas together.
3. Before a tool first writes to a path, the current contents are snapshotted
   into a `Checkpoint` — including "did not exist", which is what makes undoing
   a file *creation* work.
4. Every event (`step`, `text`, `tool_start`, `file_change`, `notice`, `done`)
   is streamed to the UI as it happens.
5. If the client disconnects, the loop aborts before the next model call and
   before the next write.
6. The message, its durable events and the checkpoint are persisted, so
   reopening the chat shows exactly what happened.

---

## Testing

```bash
npm run verify        # typecheck + lint + unit tests
npm test              # unit tests only (backend + frontend)
npm run e2e           # Playwright against a production build
```

The e2e suite needs a Clerk test account:

```bash
npm run e2e:install   # download the browser
npm run e2e:user      # provision forge.e2e+clerk_test@example.com
npm run e2e           # 16 specs, ~2 min
```

It signs in once and reuses the session, drives the real UI against the real
API, and cleans up the projects it creates.

| Suite | Count | Covers |
|---|--:|---|
| `backend/src/**/*.test.js` | 65 | path sandboxing, diff, workspace fs, tool-call recovery |
| `frontend/src/lib/*.test.ts` | 37 | diff engine, fuzzy search, colour normalisation, formatting |
| `e2e/*.spec.ts` | 16 | auth, templates, editing, saving, palette, error states, offline-Clerk resilience |

---

## Notes and constraints

- **Next.js 15 in the preview.** Next 16 doesn't boot inside a WebContainer, so
  templates pin `next@15.1.0` and the mounted `package.json` is rewritten if a
  project asks for 16. Your file on disk is never modified.
- **Cross-origin isolation.** WebContainers need `SharedArrayBuffer`, so
  `/projects/*` is served with COOP + COEP (`credentialless`). It's scoped to
  those routes so the landing and auth pages aren't affected.
- **Preview browser support.** Chromium and Firefox on desktop. Safari and
  headless browsers don't support the service-worker proxy the runtime uses.
- **Groq model churn.** Groq retires models without notice. The catalogue lives
  in `backend/src/agent/models.js`; `GET /api/agent/models` serves it to the
  client so the picker never offers something that no longer exists.

## License

MIT
