"use client";

import React from "react";

/* ── Inline formatting: **bold** and `code` ── */
const parseInlineFormatting = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} style={{ color: "var(--text-bright)", fontWeight: "bold" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

/* ── Line-level markdown renderer ── */
const renderMarkdownText = (text: string) => {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const textVal = headingMatch[2];
      const parsed = parseInlineFormatting(textVal);
      switch (level) {
        case 1:
          return <h1 key={lineIdx} className="markdown-h1">{parsed}</h1>;
        case 2:
          return <h2 key={lineIdx} className="markdown-h2">{parsed}</h2>;
        case 3:
          return <h3 key={lineIdx} className="markdown-h3">{parsed}</h3>;
        default:
          return <h4 key={lineIdx} className="markdown-h4">{parsed}</h4>;
      }
    }

    const bulletMatch = line.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      return (
        <li key={lineIdx} className="markdown-li">
          {parseInlineFormatting(bulletMatch[1])}
        </li>
      );
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      return (
        <li key={lineIdx} className="markdown-li-numbered">
          {parseInlineFormatting(numberedMatch[2])}
        </li>
      );
    }

    if (line.trim() === "") {
      return <div key={lineIdx} className="markdown-spacer" />;
    }

    return (
      <p key={lineIdx} className="markdown-p">
        {parseInlineFormatting(line)}
      </p>
    );
  });
};

/* ── Code block with Copy + optional Apply button ── */
interface CodeBlockProps {
  lang: string;
  code: string;
}

function CodeBlock({ lang, code }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-block-lang">{lang || "code"}</span>
        <button className="code-block-copy-btn" onClick={handleCopy}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

/* ── Main MessageContent component ── */
interface MessageContentProps {
  content: string;
  onApplyCode?: (code: string) => void;
}

export function MessageContent({ content, onApplyCode }: MessageContentProps) {
  if (!content) return null;

  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="message-markdown">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : "";
          const code = match ? match[2] : part.slice(3, -3);
          return (
            <CodeBlock key={index} lang={lang} code={code} />
          );
        }
        return (
          <div key={index} className="markdown-text-block" style={{ wordBreak: "break-word" }}>
            {renderMarkdownText(part)}
          </div>
        );
      })}
    </div>
  );
}
