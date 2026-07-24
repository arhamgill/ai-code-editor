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
  "llama-3.3-70b-versatile": "⚡ Llama 3.3 70B",
  "openai/gpt-oss-120b": "⚡ GPT-OSS 120B",
  "openai/gpt-oss-20b": "⚡ GPT-OSS 20B",
  "llama-3.1-8b-instant": "⚡ Llama 3.1 8B",
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
