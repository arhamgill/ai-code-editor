"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

import { useCopy } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * Markdown for assistant messages.
 *
 * Replaces a hand-rolled line-by-line parser that handled only bold, inline
 * code, headings and bullets — it emitted a separate <li> per line with no
 * wrapping list, rendered tables as plain text, and turned any stray asterisk
 * into broken markup.
 */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="text-[13px] leading-[1.65] text-fg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,

          h1: ({ children }) => (
            <h3 className="mb-2 mt-3 text-[14.5px] font-semibold text-bright first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 className="mb-1.5 mt-3 text-[13.5px] font-semibold text-bright first:mt-0">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="mb-1.5 mt-2.5 text-[13px] font-semibold text-bright first:mt-0">{children}</h5>
          ),

          ul: ({ children }) => (
            <ul className="mb-2.5 ml-4 list-disc space-y-1 marker:text-subtle last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2.5 ml-4 list-decimal space-y-1 marker:text-subtle last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
            >
              {children}
            </a>
          ),

          strong: ({ children }) => <strong className="font-semibold text-bright">{children}</strong>,

          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-2 border-border-strong pl-3 text-muted">
              {children}
            </blockquote>
          ),

          hr: () => <hr className="my-3 border-border" />,

          table: ({ children }) => (
            <div className="my-2.5 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-[12.5px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-raised px-2.5 py-1.5 text-left font-semibold text-bright">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-2.5 py-1.5 last:border-0">{children}</td>
          ),

          code: ({ className, children, ...props }) => {
            const language = /language-(\w+)/.exec(className ?? "")?.[1];
            const text = String(children).replace(/\n$/, "");

            // react-markdown gives inline and fenced code the same component;
            // a language class or an embedded newline distinguishes a block.
            if (!language && !text.includes("\n")) {
              return (
                <code
                  className="rounded-[4px] border border-border bg-raised px-1 py-px font-mono text-[12px] text-brand"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock language={language} code={text} />;
          },

          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const { copied, copy } = useCopy();

  return (
    <div className="group/code my-2.5 overflow-hidden rounded-lg border border-border bg-canvas">
      <div className="flex h-7 items-center justify-between border-b border-border bg-raised px-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-subtle">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={() => copy(code)}
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] transition-colors",
            copied ? "text-success" : "text-subtle hover:text-fg"
          )}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5">
        <code className="font-mono text-[11.5px] leading-[1.6] text-fg">{code}</code>
      </pre>
    </div>
  );
}
