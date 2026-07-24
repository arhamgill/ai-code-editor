"use client";

import React from "react";
import { Project } from "../types";

interface WelcomeScreenProps {
  activeProject: Project;
  setChatInput: (v: string) => void;
  setShowChat: (v: boolean) => void;
  recentFiles: string[];
  openFile: (path: string) => void;
}

const QUICK_PROMPTS = [
  { icon: "➕", label: "Add a new route", prompt: "Add an /about route with a link to it from the homepage." },
  { icon: "🎨", label: "Build a landing section", prompt: "Add a responsive hero and pricing section to the homepage using Tailwind." },
  { icon: "🧩", label: "Add a client component", prompt: "Create an interactive counter as a client component and use it on the homepage." },
  { icon: "⚡", label: "Suggest improvements", prompt: "Review this Next.js app and suggest 3 specific improvements." },
];

export function WelcomeScreen({ activeProject, setChatInput, setShowChat, recentFiles, openFile }: WelcomeScreenProps) {
  const handlePrompt = (prompt: string) => {
    setChatInput(prompt);
    setShowChat(true);
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-logo">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>

      <div className="welcome-title">
        <h2>{activeProject.name}</h2>
        <p>Created {new Date(activeProject.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
      </div>

      <div className="welcome-grid">
        {/* Quick AI prompts */}
        <div className="welcome-card">
          <div className="welcome-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span>Ask AI</span>
          </div>
          <div className="welcome-prompts">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q.prompt}
                className="welcome-prompt-btn"
                onClick={() => handlePrompt(q.prompt)}
              >
                <span>{q.icon}</span>
                <span>{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent files */}
        {recentFiles.length > 0 && (
          <div className="welcome-card">
            <div className="welcome-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Recent Files</span>
            </div>
            <div className="welcome-prompts">
              {recentFiles.slice(0, 5).map((f) => (
                <button
                  key={f}
                  className="welcome-prompt-btn"
                  onClick={() => openFile(f)}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                    {f.split("/").pop()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts */}
      <div className="welcome-shortcuts">
        {[
          { keys: "Ctrl+P", desc: "Quick file search" },
          { keys: "Ctrl+K", desc: "Command palette" },
          { keys: "Ctrl+`", desc: "Toggle AI chat" },
          { keys: "Ctrl+S", desc: "Save file" },
          { keys: "Ctrl+B", desc: "Toggle sidebar" },
        ].map((s) => (
          <div key={s.keys} className="welcome-shortcut-row">
            <kbd className="welcome-kbd">{s.keys}</kbd>
            <span>{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
