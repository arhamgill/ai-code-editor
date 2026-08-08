# Forge

Forge is a browser-based AI code editor for building and editing Next.js apps. Describe what you want in chat, and an autonomous Groq-powered AI agent reads, writes, and edits real files in your project — while a live preview runs entirely in your browser via WebContainers, no local dev server required.

## What it does

- **Chat with an AI agent that actually edits your code.** The agent (powered by [Groq](https://groq.com)) has tool access to your project's file system — it can list files, read them for context, write/create/delete files, and search across the codebase — and loops autonomously until the task is done.
- **See your app run instantly, in-browser.** Every project boots in a [WebContainer](https://webcontainer.io/) (via `@webcontainer/api`), running a real `next dev` server client-side. No backend compute, no Docker, no local Node install needed to preview.
- **Full code editor experience.** Monaco-powered editing (the engine behind VS Code), a file tree, tabs, a command palette, diff views for AI-proposed changes, and a history panel.
- **Persistent, multi-project workspaces.** Each signed-in user gets isolated project storage on the backend, with Postgres-backed project metadata via Prisma.
- **Authentication built-in.** User accounts and sessions are handled by [Clerk](https://clerk.com), on both the Next.js frontend and the Express backend.
- **Start from a template or from scratch.** Spin up a Next.js starter or a marketing site template, or build up a project file-by-file with the agent.

## Tech stack

**Frontend** (`frontend/`)
- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) — in-browser code editor
- [@webcontainer/api](https://webcontainer.io/) — in-browser Node.js runtime for live previews
- [Clerk](https://clerk.com/) (`@clerk/nextjs`) — authentication
- [Framer Motion](https://www.framer.com/motion/) — UI animation

**Backend** (`backend/`)
- [Express](https://expressjs.com/) (ESM) — REST + streaming API
- [Groq SDK](https://console.groq.com/docs) — LLM inference and tool-calling for the AI agent (defaults to `llama-3.3-70b-versatile`, also supports the `openai/gpt-oss` models on Groq)
- [Prisma](https://www.prisma.io/) + PostgreSQL — project/user metadata persistence
- [Clerk](https://clerk.com/) (`@clerk/express`) — API authentication, synced with the Postgres `User` table
- Server-Sent Events (SSE) — streams agent "thinking", tool calls, and file changes to the client in real time

## How the AI agent works

1. The frontend chat panel POSTs a prompt (plus conversation history) to `POST /api/agent/stream`.
2. The backend builds a system prompt describing the project's file tree and Next.js conventions (App Router, Server Components by default, Tailwind for styling, etc.), then starts a tool-calling loop against Groq.
3. On each turn the model can call one of: `list_files`, `read_file`, `write_file`, `create_file`, `delete_file`, `search_in_files`. Each tool call executes against the user's sandboxed project folder on the backend (path-traversal protected) and the result is fed back to the model.
4. File changes and tool invocations are streamed to the browser as SSE events (`tool_call`, `file_change`, `thinking`) so the UI updates live; the loop continues (up to 15 iterations) until the model responds with plain text instead of another tool call.
5. Separately, the frontend's WebContainer session mounts the current file tree into an in-browser Node runtime and runs `next dev`, so edits can be previewed immediately without any server-side build step.

## Project structure

```
ai-code-editor/
├── frontend/                       # Next.js app
│   └── src/app/
│       ├── page.tsx                 # Landing page
│       ├── sign-in/, sign-up/       # Clerk auth pages
│       └── editor/
│           ├── page.tsx             # Main editor shell
│           ├── components/          # ChatPanel, FileTree, PreviewPanel, DiffModal, CommandPalette, ...
│           └── utils/                # webcontainerSession.ts, formatters, language detection
├── backend/                        # Express API
│   ├── src/
│   │   ├── index.js                 # App entry, Clerk middleware, /api/me user sync
│   │   ├── agent.js                 # AI agent tool-calling loop + SSE streaming
│   │   ├── projects.js              # Project CRUD + file system API
│   │   └── db.js                    # Prisma client
│   └── prisma/schema.prisma         # User / Project models
├── package.json                    # Root workspace scripts (runs both apps concurrently)
└── .env.example                    # Environment variable reference
```

## Getting started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (local or hosted, e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com))
- A [Clerk](https://clerk.com) application (for both frontend publishable key and backend secret key)
- A [Groq](https://console.groq.com) API key

### 1. Clone and install

```bash
git clone https://github.com/arhamgill/ai-code-editor.git
cd ai-code-editor
npm run install:all
```

### 2. Configure environment variables

Copy `.env.example` as a reference and create the two env files it expects:

**`backend/.env`**
```env
PORT=5000
NODE_ENV=development
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql://user:password@host:5432/dbname
CLERK_SECRET_KEY=your_clerk_secret_key
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

> Note: `.env.example` lists `GEMINI_API_KEY` as a legacy placeholder — the active AI provider is **Groq**, so set `GROQ_API_KEY` instead.

### 3. Set up the database

```bash
cd backend
npx prisma migrate dev
cd ..
```

### 4. Run the app

From the repo root, this starts both the frontend (`:3000`) and backend (`:5000`) together:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000), sign in, and create a project.

### Other scripts

```bash
npm run build:frontend    # next build
npm run build:backend     # (no-op / placeholder, backend is plain Node)
npm run start:frontend    # next start
npm run start:backend     # node src/index.js
```

## Security notes

- All project files are stored per-user under `backend/storage/users/<userId>/<projectName>/`, with path-traversal checks on every file operation.
- The AI agent can only operate within the active project's directory — it has no shell/terminal access and cannot run arbitrary commands.
- Both the frontend and backend routes are gated behind Clerk authentication.

## License

No license has been specified for this project yet.
