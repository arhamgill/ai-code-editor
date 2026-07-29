"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          Forge
        </div>

        <div className="nav-actions">
          {!isLoaded ? (
            <div className="auth-skeleton" />
          ) : isSignedIn ? (
            <UserButton />
          ) : (
            <Link href="/sign-in" className="btn btn-secondary" style={{ fontSize: "0.82rem" }}>
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="hero-section">
        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          Craft Next.js apps
          <br />
          with <span>AI</span>
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease }}
        >
          Describe what you want. Forge writes the routes, components and styles,
          then runs them live in your browser.
        </motion.p>

        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease }}
        >
          {!isLoaded ? (
            <div className="cta-skeleton" />
          ) : (
            <Link href={isSignedIn ? "/editor" : "/sign-in"} className="hero-cta-primary">
              {isSignedIn ? "Open Editor" : "Start building"}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <span>© {new Date().getFullYear()} Forge</span>
        <span>Next.js · Groq · WebContainers</span>
      </footer>
    </div>
  );
}
