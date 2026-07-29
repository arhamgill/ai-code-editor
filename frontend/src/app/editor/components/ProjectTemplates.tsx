"use client";

import React, { useState } from "react";

interface TemplateFile {
  path: string;
  content: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: TemplateFile[];
}

// ─────────────────────────────────────────────────────────────
// Shared Next.js 15 + TypeScript + Tailwind v3 scaffolding.
// Versions are pinned for WebContainer compatibility: Next 16 crashes
// in the in-browser runtime, and Tailwind v4's native oxide binary is
// unreliable there — so we ship Next 15.x + Tailwind v3.
// The `dev` script is plain `next dev` (no Turbopack) to match the preview.
// ─────────────────────────────────────────────────────────────
const nextPackageJson = (name: string) =>
  JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "15.1.0",
        react: "18.3.1",
        "react-dom": "18.3.1",
      },
      devDependencies: {
        typescript: "^5",
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        tailwindcss: "^3.4.1",
        postcss: "^8",
        autoprefixer: "^10.4.20",
      },
    },
    null,
    2
  );

const NEXT_CONFIG_FILES: TemplateFile[] = [
  {
    path: "tsconfig.json",
    content: JSON.stringify(
      {
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2
    ),
  },
  {
    path: "next.config.mjs",
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
`,
  },
  {
    path: "tailwind.config.ts",
    content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,
  },
  {
    path: "postcss.config.mjs",
    content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`,
  },
  {
    path: "app/globals.css",
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
  },
  {
    path: ".gitignore",
    content: `node_modules
.next
out
.env*.local
`,
  },
];

const TEMPLATES: Template[] = [
  {
    id: "nextjs-starter",
    name: "Next.js Starter",
    description: "App Router + TypeScript + Tailwind. Minimal single page.",
    icon: "▲",
    files: [
      ...NEXT_CONFIG_FILES,
      { path: "package.json", content: nextPackageJson("nextjs-starter") },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next.js Starter",
  description: "A minimal Next.js app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
`,
      },
      {
        path: "app/page.tsx",
        content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-widest text-cyan-300">
        Next.js 15 · App Router
      </span>
      <h1 className="bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
        Hello, world
      </h1>
      <p className="max-w-md text-slate-400">
        Edit <code className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-300">app/page.tsx</code> and
        ask the AI to build something. Your changes hot-reload in the preview.
      </p>
    </main>
  );
}
`,
      },
    ],
  },
  {
    id: "nextjs-landing",
    name: "Marketing Site",
    description: "Colourful multi-route landing page with nav, hero, pricing and /about.",
    icon: "◆",
    files: [
      ...NEXT_CONFIG_FILES,
      { path: "package.json", content: nextPackageJson("marketing-site") },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumen — Ship faster",
  description: "A colourful multi-page Next.js starter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-rose-50 text-slate-900 antialiased">
        <Nav />
        {children}
        <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Lumen. Built with Next.js.
        </footer>
      </body>
    </html>
  );
}
`,
      },
      {
        path: "app/page.tsx",
        content: `import Link from "next/link";
import { Counter } from "@/components/Counter";

const features = [
  {
    title: "Lightning fast",
    body: "Server components and streaming keep every page instant.",
    accent: "from-amber-400 to-orange-500",
    icon: "⚡",
  },
  {
    title: "Type safe",
    body: "Strict TypeScript across the whole project, out of the box.",
    accent: "from-sky-400 to-indigo-500",
    icon: "◆",
  },
  {
    title: "Beautifully styled",
    body: "Tailwind utilities with a vivid, modern design system.",
    accent: "from-fuchsia-400 to-rose-500",
    icon: "✦",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          New in v2.0
        </span>

        <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl">
          Ship your ideas{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-500 bg-clip-text text-transparent">
            faster
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
          A colourful starting point for your next project. Ask the AI to add routes,
          components and features. Everything hot-reloads in the preview.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/about"
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-90"
          >
            Get started
          </Link>
          <Counter />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div
                className={\`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br \${f.accent} text-lg text-white\`}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-8 py-14 text-center text-white shadow-xl">
          <h2 className="text-3xl font-bold">Ready to build?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">
            Open the AI chat and describe the next feature you want.
          </p>
          <Link
            href="/about"
            className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            Learn more
          </Link>
        </div>
      </section>
    </main>
  );
}
`,
      },
      {
        path: "app/about/page.tsx",
        content: `export const metadata = { title: "About — Lumen" };

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-4xl font-extrabold tracking-tight">
        About{" "}
        <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
          Lumen
        </span>
      </h1>
      <p className="mt-6 text-lg text-slate-600">
        This page lives at{" "}
        <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">
          app/about/page.tsx
        </code>
        . Add more routes by creating folders under{" "}
        <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">app/</code>.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="font-semibold text-emerald-900">Server components</h3>
          <p className="mt-1 text-sm text-emerald-800/80">
            Pages render on the server by default for speed.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900">Client islands</h3>
          <p className="mt-1 text-sm text-amber-800/80">
            Add "use client" only where you need interactivity.
          </p>
        </div>
      </div>
    </main>
  );
}
`,
      },
      {
        path: "components/Nav.tsx",
        content: `import Link from "next/link";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-sm text-white">
            L
          </span>
          Lumen
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/" className="transition hover:text-indigo-600">
            Home
          </Link>
          <Link href="/about" className="transition hover:text-indigo-600">
            About
          </Link>
          <Link
            href="/about"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
          >
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}
`,
      },
      {
        path: "components/Counter.tsx",
        content: `"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      onClick={() => setCount((c) => c + 1)}
      className="rounded-lg border-2 border-indigo-200 bg-white px-6 py-3 font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50"
    >
      Clicked {count} {count === 1 ? "time" : "times"}
    </button>
  );
}
`,
      },
    ],
  },
];

interface ProjectTemplatesProps {
  onCreate: (name: string, files: TemplateFile[]) => Promise<void>;
  loading: boolean;
}

export function ProjectTemplates({ onCreate, loading }: ProjectTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setProjectName("my-app");
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName.trim()) return;
    await onCreate(projectName.trim(), selectedTemplate.files);
    setShowModal(false);
    setSelectedTemplate(null);
    setProjectName("");
  };

  return (
    <>
      <div className="templates-section">
        <h3 className="templates-heading">Start a new Next.js app</h3>
        <div className="templates-grid">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="template-card"
              onClick={() => handleSelectTemplate(t)}
            >
              <span className="template-icon">{t.icon}</span>
              <span className="template-name">{t.name}</span>
              <span className="template-desc">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Name modal */}
      {showModal && selectedTemplate && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="template-name-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="template-name-modal-header">
              <span style={{ fontSize: "1.5rem" }}>{selectedTemplate.icon}</span>
              <div>
                <h3 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>{selectedTemplate.name}</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{selectedTemplate.files.length} files</p>
              </div>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Project name
              <input
                type="text"
                className="sidebar-search-box"
                style={{ background: "#111" }}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={loading || !projectName.trim()}
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
