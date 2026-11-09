import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, kicker }: { title: string; subtitle?: string; kicker?: string }) {
  return (
    <div className="mb-6 border-b border-edge pb-4">
      {kicker ? <div className="data-font text-[10px] uppercase tracking-[0.3em] text-tactical">{kicker}</div> : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel rounded-lg ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
          <h2 className="data-font text-[11px] uppercase tracking-[0.2em] text-tactical">{title}</h2>
          {subtitle ? <span className="text-[11px] text-slate-500">{subtitle}</span> : null}
          {right ? <div className="ml-auto">{right}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent = "tactical",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "tactical" | "amber" | "cool" | "muted";
}) {
  const accentClass =
    accent === "amber" ? "text-amber" : accent === "cool" ? "text-cool" : accent === "muted" ? "text-slate-300" : "text-tactical";
  return (
    <div className="panel rounded-lg p-4">
      <div className="data-font text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`data-font mt-2 text-2xl font-semibold ${accentClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</div> : null}
    </div>
  );
}

const CLASSIFICATION_STYLE: Record<string, string> = {
  UNVERIFIED: "border-slate-600 text-slate-400",
  "SOURCE-SUPPORTED": "border-cool/50 text-cool bg-cool/5",
  "PARTIALLY-VALIDATED": "border-amber/50 text-amber bg-amber/5",
  "EXPERIMENTALLY-CONFIRMED": "border-tactical/60 text-tactical bg-tactical/10",
  "INDEPENDENTLY-REPLICATED": "border-tactical text-tactical bg-tactical/15 glow-tactical",
  "PATCHED / OBSOLETE": "border-danger/50 text-danger bg-danger/5",
};

export function ClassificationBadge({ value }: { value: string }) {
  return (
    <span
      className={`data-font inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
        CLASSIFICATION_STYLE[value] ?? "border-slate-600 text-slate-400"
      }`}
    >
      {value}
    </span>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "tactical" | "amber" | "danger" | "cool" }) {
  const tones: Record<string, string> = {
    muted: "border-edge text-slate-400",
    tactical: "border-tactical/40 text-tactical",
    amber: "border-amber/40 text-amber",
    danger: "border-danger/40 text-danger",
    cool: "border-cool/40 text-cool",
  };
  return <span className={`data-font rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}

export function Meter({ label, value, max = 100, tone = "tactical" }: { label: string; value: number; max?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colour = tone === "amber" ? "bg-amber" : tone === "cool" ? "bg-cool" : tone === "danger" ? "bg-danger" : "bg-tactical";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="data-font text-[11px] text-slate-300">{Math.round(value * 10) / 10}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded bg-panel-2">
        <div className={`h-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DataTable({
  head,
  rows,
  empty = "No records",
}: {
  head: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-edge">
            {head.map((h) => (
              <th key={h} className="data-font px-2 py-2 text-left text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-edge/50 align-top hover:bg-panel-2/60">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-2 text-slate-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const tones = {
    info: "border-cool/30 bg-cool/5 text-slate-300",
    warn: "border-amber/30 bg-amber/5 text-amber/90",
    danger: "border-danger/30 bg-danger/5 text-danger/90",
  };
  return <div className={`rounded border px-3 py-2 text-[12px] leading-relaxed ${tones[tone]}`}>{children}</div>;
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="flex flex-col border-b border-edge/50 pb-1">
          <dt className="data-font text-[10px] uppercase tracking-[0.2em] text-slate-500">{i.label}</dt>
          <dd className="text-sm text-slate-300">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
