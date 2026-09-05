export interface TemplateFile {
  path: string;
  content: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Short tags shown on the card. */
  tags: string[];
  files: TemplateFile[];
}

/*
 * Versions are pinned for the in-browser preview, not for fashion:
 *  - Next 16 does not boot inside a WebContainer, so templates stay on 15.x.
 *  - Tailwind v4's native oxide binary is unavailable there, so templates use
 *    v3 with the classic PostCSS pipeline.
 * The agent's system prompt tells the model the same thing, so it does not
 * "helpfully" upgrade them.
 */
const NEXT_VERSION = "15.1.0";
const REACT_VERSION = "18.3.1";

const packageJson = (name: string, extraDeps: Record<string, string> = {}) =>
  `${JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: NEXT_VERSION,
        react: REACT_VERSION,
        "react-dom": REACT_VERSION,
        ...extraDeps,
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
  )}\n`;

const SCAFFOLD: TemplateFile[] = [
  {
    path: "tsconfig.json",
    content: `${JSON.stringify(
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
    )}\n`,
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
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
`,
  },
  {
    path: "postcss.config.mjs",
    content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
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
  {
    path: "README.md",
    content: `# Next.js app

Scaffolded in Forge. Press **Preview** to boot the dev server in your browser,
or ask the assistant to build the next feature.

- Routes live in \`app/\`
- Shared components in \`components/\`
- Styling with Tailwind utility classes
`,
  },
];

export const TEMPLATES: Template[] = [
  {
    id: "starter",
    name: "Blank starter",
    description: "A single page with the App Router, TypeScript and Tailwind wired up.",
    tags: ["App Router", "TypeScript", "Tailwind"],
    files: [
      ...SCAFFOLD,
      { path: "package.json", content: packageJson("nextjs-starter") },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next.js Starter",
  description: "A minimal Next.js app built with Forge",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
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
      <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-sky-300">
        Next.js · App Router
      </span>

      <h1 className="bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
        Hello, world
      </h1>

      <p className="max-w-md leading-relaxed text-slate-400">
        Edit <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300">app/page.tsx</code>, or
        ask the assistant to build something. Changes hot-reload in the preview.
      </p>
    </main>
  );
}
`,
      },
    ],
  },

  {
    id: "marketing",
    name: "Marketing site",
    description: "Multi-route landing page with a nav, hero, feature grid, pricing and an about page.",
    tags: ["Multi-page", "Client components", "Responsive"],
    files: [
      ...SCAFFOLD,
      { path: "package.json", content: packageJson("marketing-site") },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumen — Ship faster",
  description: "A multi-page Next.js marketing starter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
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
        path: "components/Nav.tsx",
        content: `import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Lumen
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
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
    <div className="inline-flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <button
        onClick={() => setCount((c) => c - 1)}
        className="size-8 rounded-lg bg-slate-100 text-lg font-semibold transition-colors hover:bg-slate-200"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-10 text-center text-2xl font-bold tabular-nums">{count}</span>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="size-8 rounded-lg bg-slate-900 text-lg font-semibold text-white transition-colors hover:bg-slate-700"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
`,
      },
      {
        path: "app/page.tsx",
        content: `import Link from "next/link";
import { Counter } from "@/components/Counter";

const features = [
  { title: "Lightning fast", body: "Server components and streaming keep every page instant." },
  { title: "Type safe", body: "TypeScript everywhere, from the route handlers to the UI." },
  { title: "Styled with Tailwind", body: "Utility classes so a redesign is never a rewrite." },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Ship your idea <span className="text-indigo-600">this week</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
          A colourful multi-page starter. Edit any file and watch it hot-reload in the preview.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/pricing"
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            See pricing
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold transition-colors hover:bg-slate-50"
          >
            About us
          </Link>
        </div>
        <div className="mt-10 flex justify-center">
          <Counter />
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
      },
      {
        path: "app/pricing/page.tsx",
        content: `const tiers = [
  { name: "Hobby", price: "$0", blurb: "Everything you need to try it out.", features: ["1 project", "Community support"] },
  { name: "Pro", price: "$19", blurb: "For serious side projects.", features: ["Unlimited projects", "Email support", "Custom domains"], featured: true },
  { name: "Team", price: "$49", blurb: "Collaborate with your whole team.", features: ["Everything in Pro", "Shared workspaces", "SSO"] },
];

export const metadata = { title: "Pricing — Lumen" };

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="text-center text-4xl font-bold tracking-tight">Simple pricing</h1>
      <p className="mt-3 text-center text-slate-600">Start free. Upgrade when you outgrow it.</p>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={\`rounded-xl border p-6 \${tier.featured ? "border-indigo-600 shadow-lg" : "border-slate-200"}\`}
          >
            {tier.featured && (
              <span className="mb-3 inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Most popular
              </span>
            )}
            <h2 className="text-lg font-semibold">{tier.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{tier.blurb}</p>
            <p className="mt-4 text-4xl font-bold">
              {tier.price}
              <span className="text-base font-normal text-slate-500">/mo</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {tier.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
`,
      },
      {
        path: "app/about/page.tsx",
        content: `export const metadata = { title: "About — Lumen" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-bold tracking-tight">About Lumen</h1>
      <p className="mt-5 text-lg leading-relaxed text-slate-600">
        We build tools that get out of the way. This page is a plain server component — try asking
        the assistant to add a team section or a contact form.
      </p>
    </main>
  );
}
`,
      },
    ],
  },

  {
    id: "dashboard",
    name: "Dashboard",
    description: "An app-shell layout with a sidebar, stat cards and a sortable data table.",
    tags: ["Layout", "Data table", "Dark mode"],
    files: [
      ...SCAFFOLD,
      { path: "package.json", content: packageJson("dashboard-app") },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "An admin dashboard built with Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 overflow-x-hidden">{children}</div>
        </div>
      </body>
    </html>
  );
}
`,
      },
      {
        path: "components/Sidebar.tsx",
        content: `import Link from "next/link";

const items = [
  { href: "/", label: "Overview" },
  { href: "/customers", label: "Customers" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-800 bg-slate-900/50 p-4 sm:block">
      <p className="px-2 text-sm font-bold tracking-tight">Acme Inc.</p>
      <nav className="mt-6 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
`,
      },
      {
        path: "components/StatCard.tsx",
        content: `export function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number;
}) {
  const positive = delta >= 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className={\`mt-1 text-sm \${positive ? "text-emerald-400" : "text-rose-400"}\`}>
        {positive ? "▲" : "▼"} {Math.abs(delta)}% vs last month
      </p>
    </div>
  );
}
`,
      },
      {
        path: "app/page.tsx",
        content: `import { StatCard } from "@/components/StatCard";

const stats = [
  { label: "Revenue", value: "$48,290", delta: 12.4 },
  { label: "Active users", value: "2,318", delta: 4.1 },
  { label: "Churn", value: "1.8%", delta: -0.6 },
  { label: "Open tickets", value: "27", delta: -14.2 },
];

export default function Overview() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-slate-400">Everything at a glance.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </main>
  );
}
`,
      },
      {
        path: "app/customers/page.tsx",
        content: `const customers = [
  { name: "Ada Lovelace", email: "ada@example.com", plan: "Pro", mrr: 49 },
  { name: "Grace Hopper", email: "grace@example.com", plan: "Team", mrr: 149 },
  { name: "Alan Turing", email: "alan@example.com", plan: "Hobby", mrr: 0 },
  { name: "Katherine Johnson", email: "kj@example.com", plan: "Pro", mrr: 49 },
];

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Customers</h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/70 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 text-right font-medium">MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {customers.map((customer) => (
              <tr key={customer.email} className="transition-colors hover:bg-slate-900/40">
                <td className="px-4 py-3 font-medium">{customer.name}</td>
                <td className="px-4 py-3 text-slate-400">{customer.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs">{customer.plan}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">\${customer.mrr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
`,
      },
    ],
  },
];
