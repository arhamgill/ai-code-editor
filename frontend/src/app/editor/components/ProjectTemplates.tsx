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
  description: "Built with Forge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
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
      <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
        Next.js 15 · App Router
      </span>
      <h1 className="text-5xl font-bold tracking-tight">
        Hello from Forge
      </h1>
      <p className="max-w-md text-white/60">
        Edit <code className="rounded bg-white/10 px-1.5 py-0.5">app/page.tsx</code> and ask
        the AI to build something. Your changes hot-reload in the preview.
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
    name: "Next.js Landing",
    description: "Multi-route example: layout, nav, /about, client component.",
    icon: "◆",
    files: [
      ...NEXT_CONFIG_FILES,
      { path: "package.json", content: nextPackageJson("nextjs-landing") },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge Landing",
  description: "A multi-page Next.js starter built with Forge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
`,
      },
      {
        path: "app/page.tsx",
        content: `import { Counter } from "@/components/Counter";

const features = [
  { title: "App Router", body: "File-based routing with layouts, server and client components." },
  { title: "TypeScript", body: "Strict types across the whole project, out of the box." },
  { title: "Tailwind CSS", body: "Utility-first styling with a clean, minimal design." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Build something great</h1>
        <p className="max-w-md text-white/60">
          A multi-page Next.js starter. Ask the AI to add routes, components, and
          features — it all hot-reloads in the preview.
        </p>
        <Counter />
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border border-white/10 p-5">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-white/50">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
`,
      },
      {
        path: "app/about/page.tsx",
        content: `export const metadata = { title: "About · Forge" };

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-bold tracking-tight">About</h1>
      <p className="mt-4 text-white/60">
        This page lives at{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5">app/about/page.tsx</code>. Add
        more routes by creating folders under{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5">app/</code>.
      </p>
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
    <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <Link href="/" className="font-semibold tracking-tight">
        Forge<span className="text-white/40"> app</span>
      </Link>
      <div className="flex gap-6 text-sm text-white/60">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <Link href="/about" className="transition hover:text-white">
          About
        </Link>
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
      className="rounded-md border border-white/15 px-5 py-2.5 font-medium transition hover:border-white/40"
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
