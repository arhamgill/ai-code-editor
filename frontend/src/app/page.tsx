"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// ── Typewriter demo sequence ─────────────────────────────────
const DEMO_FRAMES = [
  { type: "user", text: "Add a dark mode toggle to my React app" },
  { type: "tool", text: "📖 Reading src/App.tsx..." },
  { type: "tool", text: "📖 Reading src/index.css..." },
  { type: "tool", text: "✏️ Modifying src/App.tsx  +24 -2" },
  { type: "tool", text: "✏️ Modifying src/index.css  +18 -0" },
  { type: "ai", text: "Done! Added a dark mode toggle that persists in localStorage. Try it in the preview →" },
];

function TypewriterDemo() {
  const [frameIdx, setFrameIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [visible, setVisible] = useState<typeof DEMO_FRAMES>([]);

  useEffect(() => {
    if (frameIdx >= DEMO_FRAMES.length) {
      // Pause then restart
      const timer = setTimeout(() => {
        setFrameIdx(0);
        setCharIdx(0);
        setVisible([]);
      }, 3500);
      return () => clearTimeout(timer);
    }

    const frame = DEMO_FRAMES[frameIdx];
    const fullText = frame.text;

    if (charIdx < fullText.length) {
      const speed = frame.type === "tool" ? 18 : 28;
      const timer = setTimeout(() => setCharIdx((c) => c + 1), speed);
      return () => clearTimeout(timer);
    } else {
      // Current frame complete — advance after delay
      const delay = frame.type === "ai" ? 1600 : frame.type === "user" ? 800 : 200;
      const timer = setTimeout(() => {
        setVisible((prev) => [...prev, frame]);
        setFrameIdx((i) => i + 1);
        setCharIdx(0);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [frameIdx, charIdx]);

  const currentFrame = frameIdx < DEMO_FRAMES.length ? DEMO_FRAMES[frameIdx] : null;
  const currentDisplayText = currentFrame ? currentFrame.text.slice(0, charIdx) : "";

  return (
    <div className="demo-window">
      <div className="demo-window-bar">
        <span className="demo-dot demo-dot-red" />
        <span className="demo-dot demo-dot-yellow" />
        <span className="demo-dot demo-dot-green" />
        <span className="demo-window-title">AuraEdit AI · workspace</span>
      </div>
      <div className="demo-body">
        {visible.map((frame, i) => (
          <div key={i} className={`demo-line demo-line-${frame.type}`}>
            {frame.type === "user" && <span className="demo-prefix demo-prefix-user">You</span>}
            {frame.type === "tool" && <span className="demo-prefix demo-prefix-tool">↳</span>}
            {frame.type === "ai" && <span className="demo-prefix demo-prefix-ai">AI</span>}
            <span>{frame.text}</span>
          </div>
        ))}
        {currentFrame && (
          <div className={`demo-line demo-line-${currentFrame.type}`}>
            {currentFrame.type === "user" && <span className="demo-prefix demo-prefix-user">You</span>}
            {currentFrame.type === "tool" && <span className="demo-prefix demo-prefix-tool">↳</span>}
            {currentFrame.type === "ai" && <span className="demo-prefix demo-prefix-ai">AI</span>}
            <span>
              {currentDisplayText}
              <span className="demo-cursor">▋</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Feature cards ────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: "Reads Your Codebase",
    desc: "The AI scans your entire project before responding — understanding file structure, dependencies, and patterns.",
    accent: "#22d3ee",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "5 AI Models",
    desc: "Switch between Gemini 2.5 Pro, Flash, Llama 3 70B, Mixtral, and more — all from one dropdown.",
    accent: "#818cf8",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    title: "Instant Revert",
    desc: "Every AI response creates a restore point. One click brings your project back to any previous state.",
    accent: "#34d399",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
    title: "Live Preview",
    desc: "Run HTML/CSS/JS projects in a sandboxed iframe. Node.js apps boot via WebContainers — no server needed.",
    accent: "#fb923c",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Monaco Editor",
    desc: "The same editor that powers VS Code — with syntax highlighting, multi-tab, word wrap, and minimap.",
    accent: "#f472b6",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Cloud Workspaces",
    desc: "Projects are stored in PostgreSQL and synced to your account. Pick up exactly where you left off.",
    accent: "#a3e635",
  },
];

// ── How it works steps ───────────────────────────────────────
const STEPS = [
  { num: "01", title: "Upload or create a project", desc: "Drag in your code folder, or start from a template (HTML, React, Express). Files are stored in your personal cloud vault." },
  { num: "02", title: "Open the AI chat", desc: "Ask anything — explain this file, refactor this function, add authentication. The AI reads your code first." },
  { num: "03", title: "Review & revert instantly", desc: "See exactly what changed with +/- line counts and diff viewer. Restore to any checkpoint with one click." },
];

// ── Tech badges ──────────────────────────────────────────────
const TECH_STACK = [
  "Gemini 2.5", "Groq", "Llama 3", "Monaco Editor",
  "Next.js 16", "Express", "Clerk Auth", "Prisma", "PostgreSQL", "WebContainers",
];

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="home-container">
      {/* Animated aurora background */}
      <div className="home-aurora" aria-hidden="true">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
      </div>

      {/* Header */}
      <header className="home-header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          AuraEdit
        </div>
        <div className="nav-actions">
          {!isLoaded ? (
            <div className="auth-skeleton" />
          ) : isSignedIn ? (
            <>
              <Link href="/editor" className="btn btn-primary" style={{ fontSize: "0.82rem", padding: "0.45rem 0.9rem" }}>
                Open Editor
              </Link>
              <UserButton appearance={{ elements: { userButtonAvatarBox: { width: "2rem", height: "2rem", borderRadius: "6px", border: "1px solid #222" } } }} />
            </>
          ) : (
            <Link href="/sign-in" className="btn btn-secondary" style={{ fontSize: "0.82rem" }}>
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <main className="hero-section">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            AI-Powered Code Editor · Portfolio Project
          </div>
        </motion.div>

        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          Code at the speed<br />of <span>thought</span>
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          An AI-native code editor that reads your codebase, understands it,<br />and makes multi-file changes — all in one cloud workspace.
        </motion.p>

        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {isLoaded ? (
            isSignedIn ? (
              <Link href="/editor" className="hero-cta-primary">
                Open Editor
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="hero-cta-primary">
                  Get Started Free
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
                <Link href="/sign-in" className="hero-cta-secondary">Sign in</Link>
              </>
            )
          ) : (
            <div style={{ height: 44, width: 180, borderRadius: 8, background: "#1a1a1a", animation: "shimmer 1.5s infinite" }} />
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="hero-stats"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {[
            { val: "5+", label: "AI Models" },
            { val: "Live", label: "Code Preview" },
            { val: "1-click", label: "Revert" },
            { val: "Cloud", label: "Workspace" },
          ].map((s) => (
            <div key={s.label} className="hero-stat">
              <span className="hero-stat-val">{s.val}</span>
              <span className="hero-stat-label">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </main>

      {/* ── Typewriter Demo ──────────────────────────────── */}
      <section className="demo-section">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="section-eyebrow">See it in action</div>
          <h2 className="section-title">Watch the AI work</h2>
          <p className="section-sub">Ask a question. Watch the AI read your files, think, and apply changes — all in real time.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <TypewriterDemo />
        </motion.div>
      </section>

      {/* ── Feature Cards ────────────────────────────────── */}
      <section className="features-section">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="section-eyebrow">Features</div>
          <h2 className="section-title">Everything you need to build faster</h2>
        </motion.div>

        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="feature-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
            >
              <div className="feature-icon" style={{ color: f.accent, background: `${f.accent}14`, border: `1px solid ${f.accent}28` }}>
                {f.icon}
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="steps-section">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="section-eyebrow">How it works</div>
          <h2 className="section-title">Up and running in seconds</h2>
        </motion.div>

        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              className="step-card"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
            >
              <div className="step-num">{s.num}</div>
              <div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ───────────────────────────────────── */}
      <section className="stack-section">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="section-eyebrow">Built with</div>
          <div className="stack-badges">
            {TECH_STACK.map((tech) => (
              <span key={tech} className="stack-badge">{tech}</span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────── */}
      <section className="cta-section">
        <motion.div
          className="cta-card"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="cta-title">Ready to build something?</h2>
          <p className="cta-sub">Upload your project folder and start chatting with the AI in under 30 seconds.</p>
          {isLoaded && (
            isSignedIn ? (
              <Link href="/editor" className="hero-cta-primary">
                Open Editor →
              </Link>
            ) : (
              <Link href="/sign-in" className="hero-cta-primary">
                Get Started Free →
              </Link>
            )
          )}
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-logo">
          <div className="logo-icon" style={{ width: 28, height: 28, fontSize: "0.7rem" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          AuraEdit AI
        </div>
        <div className="footer-links">
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            © {new Date().getFullYear()} AuraEdit · Built with Next.js, Express &amp; Gemini
          </span>
        </div>
      </footer>
    </div>
  );
}
