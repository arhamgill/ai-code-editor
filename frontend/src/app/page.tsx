"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import {
  ArrowRight,
  Blocks,
  FolderGit2,
  GitCompareArrows,
  History,
  Keyboard,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { AppPreview } from "@/components/marketing/app-preview";
import { ThemeToggle } from "@/components/theme";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";

const FEATURES = [
  {
    icon: Sparkles,
    title: "An agent that edits real files",
    body: "Ask for a change in plain English. Forge reads the files it needs, writes complete files back, and streams every step as it happens — no copy-pasting snippets.",
  },
  {
    icon: MonitorPlay,
    title: "Live preview, zero setup",
    body: "Your app runs in a WebContainer inside the browser tab. Real npm install, real next dev, real hot reload — nothing installed on your machine.",
  },
  {
    icon: History,
    title: "Undo the whole turn",
    body: "Every AI run snapshots each file before it touches it. One click rolls the entire project back — including files you never had open.",
  },
  {
    icon: GitCompareArrows,
    title: "Review before you trust",
    body: "Each edit lands with a line-accurate diff. Skim what changed, revert a single file, or keep it all.",
  },
  {
    icon: Keyboard,
    title: "Built for the keyboard",
    body: "Command palette, fuzzy file search, tab navigation and a full shortcut layer. Your hands never have to leave the keys.",
  },
  {
    icon: ShieldCheck,
    title: "Isolated per account",
    body: "Projects are scoped to your user and served from a sandboxed store with hardened path resolution and per-account rate limits.",
  },
];

const STEPS = [
  {
    icon: FolderGit2,
    title: "Start or import",
    body: "Scaffold from a Next.js template, or drop in an existing project folder.",
  },
  {
    icon: Sparkles,
    title: "Describe the change",
    body: "The agent explores the codebase, then writes the routes, components and styles.",
  },
  {
    icon: Zap,
    title: "Run it instantly",
    body: "Hit Preview and the dev server boots in-browser. Iterate until it's right.",
  },
];

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-5">
          <Logo href={null} />
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            <a
              href="#features"
              className="rounded-md px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              Features
            </a>
            <a
              href="#how"
              className="rounded-md px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              How it works
            </a>
            <a
              href="#stack"
              className="rounded-md px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              Stack
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle className="hidden sm:inline-flex" />
            {!isLoaded ? (
              <Skeleton className="h-8 w-24 rounded-md" />
            ) : isSignedIn ? (
              <>
                <LinkButton href="/projects" size="sm" variant="primary">
                  Open Forge
                </LinkButton>
                <UserButton />
              </>
            ) : (
              <>
                <LinkButton href="/sign-in" size="sm" variant="ghost">
                  Sign in
                </LinkButton>
                <LinkButton href="/sign-up" size="sm" variant="primary">
                  Get started
                </LinkButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,var(--color-brand-subtle),transparent_70%)]"
          />

          <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-16 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-raised px-3 py-1 text-[12px] text-muted">
                <span className="size-1.5 rounded-full bg-success" />
                Runs Next.js in your browser — nothing to install
              </span>

              <h1 className="mt-6 text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.03em] text-bright sm:text-6xl">
                Ship Next.js features
                <br />
                <span className="bg-gradient-to-r from-brand to-brand/55 bg-clip-text text-transparent">
                  at the speed of a sentence
                </span>
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted sm:text-[16.5px]">
                Forge is an AI pair programmer inside a real editor. Describe what you want, watch it
                edit your actual files, and run the result live — with a diff for every change and
                one-click undo for the whole turn.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {!isLoaded ? (
                  <Skeleton className="h-11 w-40 rounded-lg" />
                ) : (
                  <LinkButton
                    href={isSignedIn ? "/projects" : "/sign-up"}
                    size="lg"
                    variant="primary"
                    iconRight={<ArrowRight className="size-4" />}
                  >
                    {isSignedIn ? "Open your workspace" : "Start building free"}
                  </LinkButton>
                )}
                <LinkButton href="#how" size="lg" variant="secondary">
                  See how it works
                </LinkButton>
              </div>
            </div>

            <div className="relative mx-auto mt-14 max-w-5xl">
              <AppPreview />
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-14 border-t border-border bg-surface/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-5">
            <SectionHeading
              eyebrow="Features"
              title="Everything an AI editor actually needs"
              body="Not a chat box bolted onto a textarea — a workspace where the model, the files and the running app all stay in sync."
            />

            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="group bg-canvas p-6 transition-colors hover:bg-surface">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-raised text-brand transition-colors group-hover:border-brand/30">
                    <Icon className="size-4" />
                  </div>
                  <h3 className="mt-4 text-[14.5px] font-semibold text-bright">{title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section id="how" className="scroll-mt-14 py-20">
          <div className="mx-auto w-full max-w-6xl px-5">
            <SectionHeading eyebrow="How it works" title="Three steps, no local setup" />

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="relative rounded-xl border border-border bg-surface p-6">
                  <span className="absolute right-5 top-5 font-mono text-[28px] font-semibold leading-none text-border-strong">
                    {index + 1}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <Icon className="size-4" />
                  </div>
                  <h3 className="mt-4 text-[14.5px] font-semibold text-bright">{title}</h3>
                  <p className="mt-1.5 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Stack ────────────────────────────────────────────── */}
        <section id="stack" className="scroll-mt-14 border-t border-border bg-surface/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-5">
            <SectionHeading
              eyebrow="Under the hood"
              title="Built like production software"
              body="A typed Next.js frontend, a hardened Express API, Postgres for durable state, and an agent loop with real guard rails."
            />

            <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
              <StackCard
                icon={<Blocks className="size-4" />}
                title="Frontend"
                items={[
                  "Next.js App Router + TypeScript",
                  "Tailwind v4 design tokens, light & dark",
                  "Monaco editor, zustand state",
                  "WebContainers for the live preview",
                ]}
              />
              <StackCard
                icon={<ShieldCheck className="size-4" />}
                title="Backend"
                items={[
                  "Express with zod-validated routes",
                  "Prisma + Postgres, versioned migrations",
                  "Streaming agent over the Groq API",
                  "Per-account rate limits and path sandboxing",
                ]}
              />
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="py-20">
          <div className="mx-auto w-full max-w-3xl px-5 text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-bright sm:text-4xl">
              Start with a template. Ship in minutes.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">
              No credit card, no local toolchain, no configuration.
            </p>
            <div className="mt-7 flex justify-center">
              <LinkButton
                href={isSignedIn ? "/projects" : "/sign-up"}
                size="lg"
                variant="primary"
                iconRight={<ArrowRight className="size-4" />}
              >
                {isSignedIn ? "Open your workspace" : "Create your first project"}
              </LinkButton>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 sm:flex-row">
          <Logo href={null} className="scale-90" />
          <p className="text-[12.5px] text-subtle">
            © {new Date().getFullYear()} Forge · Next.js, WebContainers and Groq
          </p>
          <div className="sm:ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] text-bright">
        {title}
      </h2>
      {body && <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

function StackCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-canvas p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-subtle text-brand">
          {icon}
        </span>
        <h3 className="text-[14px] font-semibold text-bright">{title}</h3>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-brand" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
