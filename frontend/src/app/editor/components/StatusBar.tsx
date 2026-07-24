"use client";

import React from "react";
import { detectLanguage } from "../utils/languageDetector";

interface StatusBarProps {
  cursorPosition: { line: number; column: number };
  activeFilePath: string | null;
  selectedModel: string;
  selectionInfo?: { chars: number; lines: number } | null;
}

const MODEL_LABELS: Record<string, string> = {
  "gemini-2.5-flash": "✦ Gemini 2.5 Flash",
  "gemini-2.5-pro": "✦ Gemini 2.5 Pro",
  "gemini-2.0-flash": "✦ Gemini 2.0 Flash",
  "llama3-groq-70b-8192-tool-use-preview": "⚡ Llama 3 70B",
  "llama3-groq-8b-8192-tool-use-preview": "⚡ Llama 3 8B",
  "llama-3.3-70b-versatile": "⚡ Llama 3.3 70B",
  "llama-3.1-70b-versatile": "⚡ Llama 3.1 70B",
  "llama-3.1-8b-instant": "⚡ Llama 3.1 8B",
  "mixtral-8x7b-32768": "⚡ Mixtral 8x7B",
};

export function StatusBar({ cursorPosition, activeFilePath, selectedModel, selectionInfo }: StatusBarProps) {
  const lang = activeFilePath ? detectLanguage(activeFilePath) : null;
  const modelLabel = MODEL_LABELS[selectedModel] ?? selectedModel;

  return (
    <footer className="workspace-footer">
      <div className="status-bar-left">
        <span className="status-model">{modelLabel}</span>
      </div>

      {activeFilePath && (
        <div className="status-bar-right">
          {selectionInfo && selectionInfo.chars > 0 && (
            <span className="status-segment">
              {selectionInfo.chars} chars selected
            </span>
          )}
          <span className="status-segment">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
          {lang && (
            <span className="status-segment status-lang">
              {lang.toUpperCase()}
            </span>
          )}
        </div>
      )}
    </footer>
  );
}
