<div align="center">

<h1>⚡ Forge</h1>

**Build Next.js apps by talking to them.**

An AI code editor that lives in your browser — an autonomous agent writes the code,
a real Node.js runtime previews it live, and nothing ever touches your machine.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Groq](https://img.shields.io/badge/Groq-Agent-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)

[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=flat-square&logo=clerk&logoColor=white)](https://clerk.com/)
[![WebContainers](https://img.shields.io/badge/WebContainers-Preview-1389FD?style=flat-square&logo=stackblitz&logoColor=white)](https://webcontainer.io/)
[![Monaco](https://img.shields.io/badge/Monaco-Editor-0078D4?style=flat-square&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)

</div>

---

## 🌟 What is Forge?

Forge is a full-stack **AI code editor for Next.js**. You describe what you want in plain English; a Groq-powered agent reads your project, plans, and then actually **creates, edits, and deletes real files** — streaming every tool call and diff back to you as it works.

The result runs immediately in a **WebContainer** — a genuine Node.js runtime compiled to WebAssembly, executing `next dev` inside your browser tab. No Docker. No local Node install. No remote build servers.

> **Describe → Agent edits → Preview boots → Ship.** All in one tab.

<br/>

<table>
<tr>
<td width="50%" valign="top">

### 🤖 Agent that edits, not just chats

Six real filesystem tools (`list_files`, `read_file`, `write_file`, `create_file`, `delete_file`, `search_in_files`) wired into an autonomous loop. It reads before it writes, and iterates until the job is done.

</td>
<td width="50%" valign="top">

### ⚡ Live preview in your browser

WebContainers boot a real `next dev` server client-side. The session is a persistent singleton — close the panel and the dev server **keeps running**, so reopening is instant instead of a 30–60s rebuild.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📝 A real editor, not a textarea

Monaco (the engine behind VS Code) with a file tree, tabs, syntax detection, fuzzy file search, a command palette, and diff modals for reviewing AI changes before you accept them.

</td>
<td width="50%" valign="top">

### 🔐 Multi-tenant from day one

Clerk auth on both tiers, per-user sandboxed project storage with path-traversal guards, and Postgres-backed project metadata via Prisma.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Browser["🌐 Browser"]
        UI["Next.js 16 App Router<br/>React 19 + TypeScript"]
        Monaco["Monaco Editor<br/>file tree · tabs · diffs"]
        WC["WebContainer<br/>real Node.js in WASM<br/>running next dev"]
        UI --- Monaco
        UI --- WC
    end

    subgraph Server["🖥️ Express API"]
        Auth["Clerk middleware"]
        Agent["/api/agent/stream<br/>tool-calling loop + SSE"]
        Projects["/api/projects<br/>file CRUD"]
        Auth --> Agent
        Auth --> Projects
    end

    subgraph Data["💾 Persistence"]
        FS["Per-user file storage<br/>storage/users/:id/:project"]
        PG[("PostgreSQL<br/>via Prisma")]
    end

    Groq{{"⚡ Groq<br/>Llama 3.3 70B · GPT-OSS"}}

    UI -->|"prompt + history"| Agent
    Agent -.->|"SSE: thinking · tool_call · file_change"| UI
    Agent <-->|"tool calls"| Groq
    Agent --> FS
    Projects --> FS
    Projects --> PG
    Monaco -->|"mount file tree"| WC

    style Browser fill:#0b1220,stroke:#1e40af,color:#e2e8f0
    style Server fill:#0b1220,stroke:#059669,color:#e2e8f0
    style Data fill:#0b1220,stroke:#7c3aed,color:#e2e8f0
    style Groq fill:#F55036,stroke:#c2410c,color:#ffffff
```

---

## 🔄 How the agent actually works

The interesting part isn't the chat box — it's the loop behind it.

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 You
    participant F as 🖥️ Chat Panel
    participant A as ⚙️ Agent Route
    participant G as ⚡ Groq
    participant FS as 📁 Project Files

    U->>F: "Add a pricing page"
    F->>A: POST /api/agent/stream
    A->>A: Build system prompt<br/>(file tree + Next.js conventions)

    loop up to 15 iterations
        A->>G: messages + 6 tool definitions
        G-->>A: tool_call: read_file("app/layout.tsx")
        A-->>F: SSE: tool_call
        A->>FS: read (path-traversal checked)
        FS-->>A: contents
        A->>G: tool result
        G-->>A: tool_call: create_file("app/pricing/page.tsx")
        A->>FS: write
        A-->>F: SSE: file_change (+42 / -0)
    end

    G-->>A: plain text (no more tools)
    A-->>F: SSE: thinking (streamed tokens)
    F-->>U: ✅ Done — preview hot-reloads
```

**Step by step:**

1. The chat panel POSTs your prompt plus conversation history to `POST /api/agent/stream`.
2. The backend builds a system prompt containing the project's file listing and a strict set of **Next.js conventions** — App Router only, Server Components by default, `"use client"` only when needed, Tailwind for styling, no `pages/` directory.
3. Groq responds with tool calls. Each one executes against the user's sandboxed project directory, and the result is threaded back into the conversation.
4. Every tool call and file mutation streams to the browser as an **SSE event** (`tool_call`, `file_change`, `thinking`) so the UI updates live with per-file `+added / -removed` line counts.
5. When the model replies with text instead of another tool call, the loop ends and the response streams token-by-token.
6. Meanwhile the WebContainer has the same file tree mounted — so edits hot-reload in the preview pane immediately.

<details>
<summary><b>🛠️ Bonus: recovering from malformed tool calls</b></summary>

<br/>

Some Llama-family models on Groq occasionally emit tool calls as *text* — `<function=write_file,{"path":"...","content":"..."}>` — which Groq's API rejects with a `tool_use_failed` 400 before it ever reaches you.

Rather than surfacing that as an error, [`agent.js`](backend/src/agent.js) parses the intended call out of the `failed_generation` payload using a **brace-balancing JSON extractor** (necessary because the arguments contain code full of nested `{}`), executes the call itself, and continues the loop. A control-character-tolerant JSON parser handles unescaped newlines inside string values, another common cause of the same failure.

The user just sees the file get written.

</details>

---

## 🧠 Supported models

Switchable live from the chat panel — the status bar shows which one is active.

| Model | ID | Best for |
|:--|:--|:--|
| 🦙 **Llama 3.3 70B** | `llama-3.3-70b-versatile` | **Default.** Most reliable tool calling |
| 🧩 **GPT-OSS 120B** | `openai/gpt-oss-120b` | Reasoning-heavy tasks + tools |
| 🚀 **GPT-OSS 20B** | `openai/gpt-oss-20b` | Very fast iteration |

---

## 🧰 Tech stack

<table>
<tr><th align="left" width="140">Layer</th><th align="left">Stack</th></tr>
<tr>
<td><b>Frontend</b></td>
<td>

Next.js 16 (App Router) · React 19 · TypeScript 5 · [`@monaco-editor/react`](https://github.com/suren-atoyan/monaco-react) · [`@webcontainer/api`](https://webcontainer.io/) · [`@clerk/nextjs`](https://clerk.com/) · [Framer Motion](https://www.framer.com/motion/)

</td>
</tr>
<tr>
<td><b>Backend</b></td>
<td>

Express 4 (ESM) · [`groq-sdk`](https://console.groq.com/docs) · [Prisma 6](https://www.prisma.io/) · [`@clerk/express`](https://clerk.com/) · Server-Sent Events · Morgan · CORS

</td>
</tr>
<tr>
<td><b>Data</b></td>
<td>

PostgreSQL (`User` ↔ `Project`, Clerk ID as primary key) · per-user filesystem storage

</td>
</tr>
</table>

---

## 📁 Project structure

```
ai-code-editor/
├── frontend/                        # Next.js app
│   └── src/app/
│       ├── page.tsx                 # Landing page
│       ├── sign-in/  sign-up/       # Clerk auth pages
│       ├── middleware.ts            # Route protection
│       └── editor/
│           ├── page.tsx             # Editor shell · state · shortcuts
│           ├── components/
│           │   ├── ChatPanel.tsx           # Agent chat + model picker
│           │   ├── PreviewPanel.tsx        # WebContainer preview
│           │   ├── FileTree.tsx            # Sidebar explorer
│           │   ├── DiffModal.tsx           # Review AI changes
│           │   ├── CommandPalette.tsx      # ⌘K
│           │   ├── ProjectTemplates.tsx    # Starter scaffolds
│           │   ├── HistoryPanel.tsx        # Chat history
│           │   └── ...
│           └── utils/
│               ├── webcontainerSession.ts  # ⭐ Persistent preview singleton
│               ├── languageDetector.ts
│               └── formatters.ts
├── backend/                         # Express API
│   ├── src/
│   │   ├── index.js                 # Entry · Clerk middleware · user sync
│   │   ├── agent.js                 # ⭐ Tool-calling loop + SSE streaming
│   │   ├── projects.js              # Project & file CRUD
│   │   └── db.js                    # Prisma client
│   └── prisma/schema.prisma         # User / Project models
├── package.json                     # Root scripts (runs both concurrently)
└── .env.example
```

---

## 🚀 Getting started

### Prerequisites

| Requirement | Notes |
|:--|:--|
| **Node.js 18+** | |
| **PostgreSQL** | Local, or hosted via [Neon](https://neon.tech) / [Supabase](https://supabase.com) |
| **Clerk app** | Free tier — grab the publishable + secret keys |
| **Groq API key** | Free tier at [console.groq.com](https://console.groq.com) |

### 1️⃣ Clone & install

```bash
git clone https://github.com/arhamgill/ai-code-editor.git
cd ai-code-editor
npm run install:all
```

### 2️⃣ Configure environment

<details open>
<summary><b>backend/.env</b></summary>

```env
PORT=5000
NODE_ENV=development

# AI
GROQ_API_KEY=gsk_your_groq_key

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Auth
CLERK_SECRET_KEY=sk_test_your_clerk_secret
```

</details>

<details open>
<summary><b>frontend/.env.local</b></summary>

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret
```

</details>

> [!NOTE]
> `.env.example` still lists `GEMINI_API_KEY` from an earlier iteration. The active provider is **Groq** — set `GROQ_API_KEY`.

### 3️⃣ Set up the database

```bash
cd backend && npx prisma migrate dev && cd ..
```

### 4️⃣ Launch 🎉

```bash
npm run dev
```

<div align="center">

**Frontend → [localhost:3000](http://localhost:3000)  ·  API → [localhost:5000](http://localhost:5000)**

</div>

Sign in, pick a template, and start prompting.

---

## ⌨️ Keyboard shortcuts

<div align="center">

| Shortcut | Action |
|:--:|:--|
| <kbd>Ctrl/⌘</kbd> + <kbd>S</kbd> | Save current file |
| <kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> | Command palette |
| <kbd>Ctrl/⌘</kbd> + <kbd>P</kbd> | Fuzzy file search |
| <kbd>Ctrl/⌘</kbd> + <kbd>B</kbd> | Toggle sidebar |
| <kbd>Ctrl/⌘</kbd> + <kbd>`</kbd> | Toggle AI chat |
| <kbd>Esc</kbd> | Close any overlay |

</div>

---

## 🎨 Starter templates

| Template | What you get |
|:--|:--|
| **Next.js Starter** | App Router + TypeScript + Tailwind. Minimal single page. |
| **Marketing Site** | Colourful multi-route landing page — nav, hero, pricing, and `/about`. |

Or start empty and let the agent scaffold it for you.

---

## 📡 API reference

<details>
<summary><b>Expand endpoints</b></summary>

<br/>

All routes require a Clerk session.

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/api/health` | Uptime + environment |
| `GET` | `/api/me` | Current user (syncs Clerk → Postgres on first hit) |
| `POST` | `/api/agent/stream` | **SSE** — agent tool-calling loop |
| `GET` | `/api/projects` | List your projects |
| `POST` | `/api/projects/upload` | Create a project from a file set |
| `GET` | `/api/projects/:id/files` | Recursive file tree |
| `POST` | `/api/projects/:id/read` | Read a file |
| `POST` | `/api/projects/:id/write` | Write a file |
| `POST` | `/api/projects/:id/rename` | Rename a file or folder |
| `POST` | `/api/projects/:id/mkdir` | Create a directory |
| `DELETE` | `/api/projects/:id/file` | Delete a file or folder |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `GET` | `/api/projects/:id/stats` | Project statistics |

**SSE event types on `/api/agent/stream`:**

| Event | Payload |
|:--|:--|
| `thinking` | `{ text }` — streamed response tokens |
| `tool_call` | `{ name, args }` — a tool the agent invoked |
| `file_change` | `{ action, path, added, removed }` — Created / Modified / Deleted |
| `error` | `{ message }` |
| `[DONE]` | Stream terminator |

</details>

---

## 🔒 Security model

- 🗂️ **Sandboxed storage** — files live under `backend/storage/users/<userId>/<projectName>/`, and **every** path is validated to stay inside the project boundary before any read or write.
- 🚫 **No shell access** — the agent can only touch files through its six declared tools. It cannot run terminal commands, install packages, or reach the network.
- 🔑 **Auth on both tiers** — Clerk guards the Next.js routes via middleware and every Express endpoint via `getAuth()`; users are lazily provisioned into Postgres with an idempotent `upsert`.
- 🧱 **Preview isolation** — the WebContainer runs in the browser's own sandbox, so previewed code never executes on the server.

---

## 🗺️ Roadmap ideas

- [ ] Terminal access inside the WebContainer preview
- [ ] Multi-file diff review + selective accept/reject
- [ ] Git integration & one-click deploy
- [ ] Framework support beyond Next.js

---

## 📄 License

No license has been specified for this project yet.

<div align="center">
<br/>

**Built with ⚡ by [@arhamgill](https://github.com/arhamgill)**

</div>
