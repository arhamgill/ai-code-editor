"use client";

import React from "react";
import { detectLanguage } from "../utils/languageDetector";

interface StatusBarProps {
  cursorPosition: { line: number; column: number };
  activeFilePath: string | null;
  selectedModel: string;
  selectionInfo?: { chars: number; lines: number } | null;
  wordWrap?: "on" | "off";
  onToggleWrap?: () => void;
  onShowShortcuts?: () => void;
  previewRunning?: boolean;
}

const MODEL_LABELS: Record<string, string> = {
  "llama-3.3-70b-versatile": "Llama 3.3 70B",
  "openai/gpt-oss-120b": "GPT-OSS 120B",
  "openai/gpt-oss-20b": "GPT-OSS 20B",
  "llama-3.1-8b-instant": "Llama 3.1 8B",
};

export function StatusBar({
  cursorPosition,
  activeFilePath,
  selectedModel,
  selectionInfo,
  wordWrap = "off",
  onToggleWrap,
  onShowShortcuts,
  previewRunning,
}: StatusBarProps) {
  const lang = activeFilePath ? detectLanguage(activeFilePath) : null;
  const modelLabel = MODEL_LABELS[selectedModel] ?? selectedModel;

  return (
    <footer className="workspace-footer">
      <div className="status-bar-left">
        <span className="status-model" title="Active AI model">
          <span className={`status-dot ${previewRunning ? "live" : ""}`} />
          {modelLabel}
        </span>
      </div>

      <div className="status-bar-right">
        {activeFilePath && (
          <>
            {selectionInfo && selectionInfo.chars > 0 && (
              <span className="status-segment status-selection">
                {selectionInfo.chars} selected
                {selectionInfo.lines > 1 ? ` · ${selectionInfo.lines} lines` : ""}
              </span>
            )}

            <span className="status-segment" title="Cursor position">
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>

            {onToggleWrap && (
              <button
                className={`status-segment status-btn ${wordWrap === "on" ? "on" : ""}`}
                onClick={onToggleWrap}
                title="Toggle word wrap"
              >
                Wrap: {wordWrap === "on" ? "On" : "Off"}
              </button>
            )}

            {lang && (
              <span className="status-segment status-lang" title="Language">
                {lang.toUpperCase()}
              </span>
            )}
          </>
        )}

        {onShowShortcuts && (
          <button className="status-segment status-btn" onClick={onShowShortcuts} title="Keyboard shortcuts">
            ⌘ Shortcuts
          </button>
        )}
      </div>
    </footer>
  );
}
