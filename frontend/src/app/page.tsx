"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton, useAuth, useUser } from "@clerk/nextjs";

interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

interface SecureResponse {
  message: string;
  userId: string;
  email: string;
  snippetCount: number;
  timestamp: string;
}

interface Snippet {
  id: string;
  title: string;
  code: string;
  createdAt: string;
}

export default function Home() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // Express API States
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);

  // Secure Route States
  const [secureStatus, setSecureStatus] = useState<"idle" | "checking" | "authorized" | "unauthorized" | "offline">("idle");
  const [secureData, setSecureData] = useState<SecureResponse | null>(null);

  // Database Snippets States
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newCode, setNewCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadingSnippets, setLoadingSnippets] = useState(false);

  const checkHealthAndSecureRoute = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    // 1. Check Public Health Endpoint
    try {
      const res = await fetch(`${apiUrl}/api/health`);
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setBackendStatus("online");
        setHealthData(data);
      } else {
        setBackendStatus("offline");
      }
    } catch (err) {
      setBackendStatus("offline");
    }

    // 2. Check Protected Secure Route
    if (!isSignedIn) {
      setSecureStatus("unauthorized");
      setSecureData(null);
      return;
    }

    try {
      setSecureStatus("checking");
      const token = await getToken();
      if (!token) {
        setSecureStatus("unauthorized");
        return;
      }

      const res = await fetch(`${apiUrl}/api/protected`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data: SecureResponse = await res.json();
        setSecureStatus("authorized");
        setSecureData(data);
      } else {
        setSecureStatus("unauthorized");
      }
    } catch (err) {
      setSecureStatus("offline");
    }
  };

  const fetchSnippets = async () => {
    if (!isSignedIn) return;
    try {
      setLoadingSnippets(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/snippets`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSnippets(data);
      }
    } catch (err) {
      console.error("Failed to fetch snippets from database:", err);
    } finally {
      setLoadingSnippets(false);
    }
  };

  const handleSaveSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) return;

    try {
      setIsSaving(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/snippets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle,
          code: newCode
        })
      });

      if (res.ok) {
        setNewTitle("");
        setNewCode("");
        // Reload list and update user stats card
        await fetchSnippets();
        await checkHealthAndSecureRoute();
      }
    } catch (err) {
      console.error("Failed to save snippet:", err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    checkHealthAndSecureRoute();
    if (isSignedIn) {
      fetchSnippets();
    } else {
      setSnippets([]);
    }

    const interval = setInterval(() => {
      checkHealthAndSecureRoute();
      if (isSignedIn) {
        fetchSnippets();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  return (
    <div className="app-container">
      {/* Sticky Navigation Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span>AuraEdit AI</span>
        </div>
        <ul className="nav-links">
          <li><a href="#features" className="nav-link">Features</a></li>
          <li><a href="#integration" className="nav-link">Integration</a></li>
          <li><a href="#database" className="nav-link">Database Storage</a></li>
          <li><Link href="/editor" className="nav-link" style={{ color: "var(--color-cyan)" }}>Open Editor</Link></li>
        </ul>
        <div className="nav-actions">
          <a href="#integration" className="btn btn-secondary">Check Connection</a>
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" appearance={{
              elements: {
                userButtonAvatarBox: {
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)'
                }
              }
            }} />
          ) : (
            <Link href="/sign-in" className="btn btn-primary">Sign In</Link>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-tag">AuraEdit v1.0.0 is Live</div>
          <h1 className="hero-title">
            Write Code at the Speed of Thought
          </h1>
          
          {isSignedIn ? (
            <p className="hero-subtitle" style={{ color: "#a5b4fc", fontWeight: 600 }}>
              Welcome back, {user?.firstName || user?.username || "Developer"}! 👋
            </p>
          ) : (
            <p className="hero-subtitle">
              A premium, next-generation development platform powered by local AI capabilities. Fully integrated Next.js frontend, Express backend, and Clerk auth.
            </p>
          )}

          <div className="hero-ctas">
            {isSignedIn ? (
              <div style={{ display: "flex", gap: "1rem" }}>
                <Link href="/editor" className="btn btn-primary" style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}>
                  Launch Code Editor
                </Link>
                <a href="#database" className="btn btn-secondary" style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}>
                  My Saved Snippets ({snippets.length})
                </a>
              </div>
            ) : (
              <Link href="/sign-in" className="btn btn-primary" style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}>
                Sign In to Start
              </Link>
            )}
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-secondary" 
              style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}
            >
              View Repository
            </a>
          </div>

          {/* Interactive Code Editor Preview Mockup */}
          <div className="demo-container">
            <div className="editor-window">
              <div className="editor-header">
                <div className="window-dots">
                  <div className="dot dot-red"></div>
                  <div className="dot dot-yellow"></div>
                  <div className="dot dot-green"></div>
                </div>
                <div className="file-tab">App.tsx</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  TypeScript - UTF-8
                </div>
              </div>
              <div className="editor-body">
                <div className="line-numbers">
                  <div>1</div>
                  <div>2</div>
                  <div>3</div>
                  <div>4</div>
                  <div>5</div>
                  <div>6</div>
                  <div>7</div>
                </div>
                <div className="code-content" style={{ paddingLeft: "1.5rem" }}>
                  <div>
                    <span className="code-keyword">import</span> React <span className="code-keyword">from</span> <span className="code-string">"react"</span>;
                  </div>
                  <div>
                    <span className="code-comment">// AuraEdit Autocomplete Suggestion</span>
                  </div>
                  <div>
                    <span className="code-keyword">export default function</span> <span className="code-function">AuraApp</span>() &#123;
                  </div>
                  <div style={{ paddingLeft: "1.5rem" }}>
                    <span className="code-keyword">const</span> [state, setState] = React.<span className="code-function">useState</span>(<span className="code-string">"Active"</span>);
                  </div>
                  <div style={{ paddingLeft: "1.5rem" }}>
                    <span className="code-keyword">return</span> &lt;<span className="code-function">div</span>&gt;Aura AI Active: &#123;state&#125;&lt;/<span className="code-function">div</span>&gt;;
                  </div>
                  <div>&#125;</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Live Status Cards */}
        <section id="integration" style={{ padding: "2rem 1rem", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "2rem" }}>
            
            {/* Express Backend Live Status Card */}
            <div className="status-card" style={{ margin: 0, width: "100%", maxWidth: "none" }}>
              <div className="status-info">
                <span className="status-title">Express API Server Connection</span>
                <p className="status-description">
                  {backendStatus === "online" && healthData
                    ? `Connected! Server uptime: ${Math.floor(healthData.uptime)}s. Live connection active.`
                    : backendStatus === "checking"
                    ? "Pinging Express backend server..."
                    : "Unable to reach the Express backend server. Make sure the Node server is running."}
                </p>
              </div>
              <div className="status-indicator">
                <div
                  className={`status-dot ${
                    backendStatus === "online"
                      ? "status-online"
                      : backendStatus === "offline"
                      ? "status-offline"
                      : ""
                  }`}
                  style={{
                    backgroundColor:
                      backendStatus === "checking" ? "var(--color-warning)" : undefined,
                    boxShadow:
                      backendStatus === "checking" ? "0 0 10px rgba(245, 158, 11, 0.6)" : undefined,
                  }}
                ></div>
                <span>
                  {backendStatus === "online"
                    ? "ONLINE"
                    : backendStatus === "offline"
                    ? "OFFLINE"
                    : "CHECKING..."}
                </span>
              </div>
            </div>

            {/* Secure Route Verification Status Card */}
            <div className="status-card" style={{ margin: 0, width: "100%", maxWidth: "none", borderLeft: "2px solid var(--color-purple)" }}>
              <div className="status-info">
                <span className="status-title">Express Secure Endpoint Bridge</span>
                <p className="status-description">
                  {secureStatus === "authorized" && secureData
                    ? `Authenticated! User: ${secureData.email}. Saved Snippets in PostgreSQL: ${secureData.snippetCount}`
                    : secureStatus === "unauthorized"
                    ? "Verify token bridge: Sign in above to query secured Express endpoints."
                    : secureStatus === "checking"
                    ? "Exchanging Clerk session token with backend..."
                    : "Secure endpoint offline or disconnected."}
                </p>
              </div>
              <div className="status-indicator">
                <div
                  className={`status-dot ${
                    secureStatus === "authorized"
                      ? "status-online"
                      : secureStatus === "unauthorized"
                      ? "status-offline"
                      : ""
                  }`}
                  style={{
                    backgroundColor:
                      secureStatus === "checking" ? "var(--color-warning)" : 
                      secureStatus === "unauthorized" ? "var(--text-muted)" : undefined,
                    boxShadow:
                      secureStatus === "checking" ? "0 0 10px rgba(245, 158, 11, 0.6)" : 
                      secureStatus === "unauthorized" ? "none" : undefined,
                  }}
                ></div>
                <span style={{ color: secureStatus === "authorized" ? "var(--color-success)" : "inherit" }}>
                  {secureStatus === "authorized"
                    ? "SECURE BRIDGE"
                    : secureStatus === "unauthorized"
                    ? "LOCKED"
                    : secureStatus === "checking"
                    ? "VERIFYING..."
                    : "OFFLINE"}
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* Database Storage Live Dashboard Section */}
        <section id="database" className="snippets-section">
          <h2 className="section-title">Secure Code Cloud (PostgreSQL Storage)</h2>

          {isSignedIn ? (
            <div className="snippets-grid">
              
              {/* Left Column: Create Snippet Form */}
              <div className="snippets-card">
                <h3 className="snippets-card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                  </svg>
                  Save New Snippet
                </h3>
                <form onSubmit={handleSaveSnippet} className="snippet-form">
                  <div className="form-group">
                    <label className="form-label">Snippet Title</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Fetch API Helper"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Code Block</label>
                    <textarea
                      className="form-textarea"
                      placeholder="export const fetchUsers = () => { ... }"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving}
                    style={{ width: "100%" }}
                  >
                    {isSaving ? "Saving to Postgres..." : "Save to Neon Postgres"}
                  </button>
                </form>
              </div>

              {/* Right Column: Snippets List */}
              <div className="snippets-card" style={{ borderLeft: "2px solid var(--color-cyan)" }}>
                <h3 className="snippets-card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Your Cloud Snippets
                </h3>

                {loadingSnippets && snippets.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                    Loading snippets from Neon Database...
                  </div>
                ) : snippets.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)", fontStyle: "italic", padding: "2rem 0" }}>
                    No snippets saved yet. Submit the form on the left to save code into Neon PostgreSQL.
                  </div>
                ) : (
                  <div className="snippet-list">
                    {snippets.map((snip) => (
                      <div key={snip.id} className="snippet-item">
                        <div className="snippet-item-header">
                          <span className="snippet-item-title">{snip.title}</span>
                          <span className="snippet-item-date">
                            {new Date(snip.createdAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short"
                            })}
                          </span>
                        </div>
                        <pre className="snippet-item-code">
                          <code>{snip.code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="locked-overlay">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--color-purple)" }}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <h3 style={{ fontSize: "1.25rem", color: "#fff" }}>PostgreSQL Code Vault Locked</h3>
              <p style={{ color: "var(--text-secondary)", maxWidth: "450px", fontSize: "0.95rem" }}>
                You must sign in with Clerk to access database storage. Once logged in, you can save, update, and manage code snippets synced securely in Neon Postgres.
              </p>
              <Link href="/sign-in" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
                Sign In to Unlock
              </Link>
            </div>
          )}
        </section>

        {/* Feature Cards Grid */}
        <section id="features" className="features-section">
          <h2 className="section-title">Designed for Visual & Speed Excellence</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 className="feature-title">Microsecond Bootup</h3>
              <p className="feature-desc">
                Optimized workspace configurations allow both the Next.js client and Express server to boot concurrently in less than a second.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <h3 className="feature-title">Independent Deployments</h3>
              <p className="feature-desc">
                Separate directory configuration enables direct deployment of the frontend to Vercel and the backend to Render, Railway, or VPS.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M 12 22 C 17.523 22 22 17.523 22 12 S 17.523 2 12 2 S 2 6.477 2 12 s 4.477 10 10 10 z" />
                  <path d="M 12 16 v -4" />
                  <path d="M 12 8 h 0.01" />
                </svg>
              </div>
              <h3 className="feature-title">Secure Authentication Bridge</h3>
              <p className="feature-desc">
                Authentication state is managed by Clerk and securely forwarded to Express routes using custom bearer tokens verified on the fly.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Premium Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} AuraEdit AI. All rights reserved.</p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Powered by Next.js & Node.js Express. Secured by Clerk. Connected to Neon Postgres.
        </p>
      </footer>
    </div>
  );
}
