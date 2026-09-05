import { Check, FileCode2, Folder, Plus, Sparkles, Terminal } from "lucide-react";

/**
 * A static, self-contained mock of the workspace, used as the hero visual.
 *
 * Rendered from real markup rather than a screenshot so it stays sharp at any
 * resolution, follows the active theme, and never goes stale when the editor
 * chrome changes.
 */
export function AppPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)]">
      {/* Title bar */}
      <div className="flex h-9 items-center gap-2 border-b border-border bg-raised px-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 font-mono text-[11px] text-subtle">acme-storefront</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-2 py-0.5 text-[10px] font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" />
          preview running
        </span>
      </div>

      <div className="grid h-[340px] grid-cols-[132px_1fr_224px] text-[11px] sm:h-[400px] sm:grid-cols-[152px_1fr_260px]">
        {/* Explorer */}
        <aside className="border-r border-border bg-surface p-2">
          <p className="px-1.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-subtle">
            Explorer
          </p>
          <TreeRow icon={<Folder className="size-3 text-brand" />} label="app" depth={0} />
          <TreeRow icon={<FileCode2 className="size-3 text-subtle" />} label="layout.tsx" depth={1} />
          <TreeRow icon={<FileCode2 className="size-3 text-brand" />} label="page.tsx" depth={1} active />
          <TreeRow icon={<Folder className="size-3 text-brand" />} label="pricing" depth={1} />
          <TreeRow icon={<FileCode2 className="size-3 text-success" />} label="page.tsx" depth={2} added />
          <TreeRow icon={<Folder className="size-3 text-brand" />} label="components" depth={0} />
          <TreeRow icon={<FileCode2 className="size-3 text-subtle" />} label="Nav.tsx" depth={1} />
        </aside>

        {/* Editor */}
        <section className="min-w-0 bg-canvas">
          <div className="flex h-7 items-center gap-1 border-b border-border bg-surface px-2">
            <span className="rounded-t-[4px] border-b-[1.5px] border-brand bg-canvas px-2 py-1 font-mono text-[10px] text-bright">
              page.tsx
            </span>
            <span className="px-2 py-1 font-mono text-[10px] text-subtle">Nav.tsx</span>
          </div>
          <pre className="overflow-hidden p-3 font-mono text-[10.5px] leading-[1.75] sm:text-[11px]">
            <CodeLine n={1}>
              <K>import</K> Link <K>from</K> <S>&quot;next/link&quot;</S>;
            </CodeLine>
            <CodeLine n={2} />
            <CodeLine n={3}>
              <K>export default function</K> <F>Home</F>() {"{"}
            </CodeLine>
            <CodeLine n={4}>
              {"  "}
              <K>return</K> (
            </CodeLine>
            <CodeLine n={5}>
              {"    "}&lt;<T>main</T> <A>className</A>=<S>&quot;p-12&quot;</S>&gt;
            </CodeLine>
            <CodeLine n={6}>
              {"      "}&lt;<T>h1</T>&gt;Acme Storefront&lt;/<T>h1</T>&gt;
            </CodeLine>
            <CodeLine n={7} added>
              {"      "}&lt;<T>Link</T> <A>href</A>=<S>&quot;/pricing&quot;</S>&gt;Pricing&lt;/<T>Link</T>&gt;
            </CodeLine>
            <CodeLine n={8}>
              {"    "}&lt;/<T>main</T>&gt;
            </CodeLine>
            <CodeLine n={9}>{"  "});</CodeLine>
            <CodeLine n={10}>{"}"}</CodeLine>
          </pre>
        </section>

        {/* Chat */}
        <aside className="flex flex-col border-l border-border bg-surface">
          <div className="flex h-7 items-center gap-1.5 border-b border-border px-2.5">
            <Sparkles className="size-3 text-brand" />
            <span className="text-[10px] font-medium text-muted">Assistant</span>
          </div>

          <div className="flex-1 space-y-2 overflow-hidden p-2.5">
            <div className="ml-auto w-fit max-w-[92%] rounded-lg rounded-br-sm bg-brand px-2.5 py-1.5 text-[10.5px] leading-snug text-brand-fg">
              Add a pricing page and link it from the homepage
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-subtle">
                <Check className="size-3 text-success" />
                Read app/page.tsx
              </div>
              <ChangeChip action="new" path="app/pricing/page.tsx" added={42} />
              <ChangeChip action="edit" path="app/page.tsx" added={1} removed={0} />
              <p className="pt-0.5 text-[10.5px] leading-relaxed text-muted">
                Added a pricing route with three tiers and linked it from the homepage nav.
              </p>
            </div>
          </div>

          <div className="border-t border-border p-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-canvas px-2 py-1.5">
              <Plus className="size-3 text-subtle" />
              <span className="text-[10px] text-subtle">Ask for a change…</span>
              <Terminal className="ml-auto size-3 text-subtle" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── tiny presentational helpers ─────────────────────────────────── */

function TreeRow({
  icon,
  label,
  depth,
  active,
  added,
}: {
  icon: React.ReactNode;
  label: string;
  depth: number;
  active?: boolean;
  added?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-[4px] py-[3px] pr-1 text-[10.5px] ${
        active ? "bg-active text-bright" : "text-muted"
      }`}
      style={{ paddingLeft: 6 + depth * 10 }}
    >
      {icon}
      <span className="truncate">{label}</span>
      {added && <span className="ml-auto font-mono text-[9px] text-success">A</span>}
    </div>
  );
}

function CodeLine({ n, added, children }: { n: number; added?: boolean; children?: React.ReactNode }) {
  return (
    <div className={added ? "-mx-3 bg-added-bg px-3" : undefined}>
      <span className="mr-3 inline-block w-4 select-none text-right text-subtle/60">{n}</span>
      <span className="text-fg">{children}</span>
    </div>
  );
}

const K = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#c586c0] dark:text-[#c586c0]">{children}</span>
);
const S = ({ children }: { children: React.ReactNode }) => <span className="text-success">{children}</span>;
const F = ({ children }: { children: React.ReactNode }) => <span className="text-brand">{children}</span>;
const T = ({ children }: { children: React.ReactNode }) => <span className="text-warning">{children}</span>;
const A = ({ children }: { children: React.ReactNode }) => <span className="text-muted">{children}</span>;

function ChangeChip({
  action,
  path,
  added,
  removed,
}: {
  action: "new" | "edit";
  path: string;
  added: number;
  removed?: number;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-raised px-1.5 py-1">
      <span
        className={`rounded-[3px] px-1 text-[9px] font-semibold uppercase ${
          action === "new" ? "bg-success-subtle text-success" : "bg-brand-subtle text-brand"
        }`}
      >
        {action}
      </span>
      <span className="truncate font-mono text-[9.5px] text-fg">{path}</span>
      <span className="ml-auto font-mono text-[9px] text-success">+{added}</span>
      {removed ? <span className="font-mono text-[9px] text-danger">−{removed}</span> : null}
    </div>
  );
}
