import { db } from "@/db";
import { discoveries } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { CREATURE_BY_SLUG } from "@/lib/ark";
import { DISCOVERY_CLASSIFICATIONS } from "@/lib/ark/types";
import { ClassificationBadge, DataTable, Meter, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DiscoveryDatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ classification?: string; domain?: string; agent?: string; surprising?: string }>;
}) {
  await ensureSeeded();
  const params = await searchParams;
  const rows = await db.select().from(discoveries);
  const filtered = rows
    .filter((d) => (params.classification ? d.classification === params.classification : true))
    .filter((d) => (params.domain ? d.domain === params.domain : true))
    .filter((d) => (params.agent ? d.foundBy === params.agent : true))
    .filter((d) => (params.surprising === "1" ? d.surprising : true))
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const domains = [...new Set(rows.map((d) => d.domain))].sort();
  const agents = [...new Set(rows.map((d) => d.foundBy))].sort();

  return (
    <div>
      <PageHeader
        kicker="Section 11 · Discovery Database"
        title="Discovery Classification Register"
        subtitle="Every finding carries a classification, a confidence score, an evidence-quality rating and the agent that produced it. Popularity is never treated as effectiveness: a widely-used composition with no measurement stays UNVERIFIED, while an obscure combination with recorded evidence is promoted."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {DISCOVERY_CLASSIFICATIONS.map((c) => (
          <StatTile
            key={c}
            label={c}
            value={rows.filter((d) => d.classification === c).length}
            accent={c === "INDEPENDENTLY-REPLICATED" || c === "EXPERIMENTALLY-CONFIRMED" ? "tactical" : c === "PARTIALLY-VALIDATED" ? "amber" : "muted"}
          />
        ))}
      </div>

      <form className="panel mt-4 flex flex-wrap gap-2 rounded-lg p-3" action="/discoveries">
        <select name="classification" defaultValue={params.classification ?? ""} className="data-font rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200">
          <option value="">all classifications</option>
          {DISCOVERY_CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="domain" defaultValue={params.domain ?? ""} className="data-font rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200">
          <option value="">all domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select name="agent" defaultValue={params.agent ?? ""} className="data-font rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200">
          <option value="">all agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="data-font flex items-center gap-2 rounded border border-edge px-2 py-1.5 text-[11px] text-slate-300">
          <input type="checkbox" name="surprising" value="1" defaultChecked={params.surprising === "1"} />
          surprising only
        </label>
        <button type="submit" className="data-font rounded border border-tactical/50 bg-tactical/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-tactical">
          Filter
        </button>
      </form>

      <Panel title="Discoveries" subtitle={`${filtered.length} of ${rows.length}`} className="mt-4">
        <div className="space-y-3">
          {filtered.map((d) => (
            <article key={d.code} className="rounded border border-edge/60 bg-panel-2/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="data-font text-[10px] text-slate-600">{d.code}</span>
                <ClassificationBadge value={d.classification} />
                {d.surprising ? <Tag tone="amber">surprising</Tag> : null}
                <Tag>{d.domain}</Tag>
                <span className="data-font ml-auto text-[10px] text-slate-500">
                  {d.foundBy} · evidence: {d.evidenceQuality}
                </span>
              </div>
              <h3 className="mt-1 text-[13px] font-medium text-slate-100">{d.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{d.summary}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <Meter label={`confidence ${d.confidenceScore}/100`} value={d.confidenceScore} tone={d.confidenceScore >= 60 ? "tactical" : "amber"} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(d.creatureSlugs ?? []).slice(0, 8).map((s) => (
                    <Tag key={s} tone="cool">
                      {CREATURE_BY_SLUG.get(s)?.name ?? s}
                    </Tag>
                  ))}
                  {(d.buffSlugs ?? []).slice(0, 5).map((s) => (
                    <Tag key={s} tone="muted">
                      {s}
                    </Tag>
                  ))}
                </div>
              </div>
              {(d.sourceKeys ?? []).length > 0 ? (
                <div className="data-font mt-2 text-[10px] text-slate-600">sources: {d.sourceKeys.join(", ")}</div>
              ) : null}
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Classification framework" className="mt-4">
        <DataTable
          head={["Classification", "Meaning", "Requirement"]}
          rows={[
            ["UNVERIFIED", "Theoretical combination requiring investigation", "Model output only"],
            ["SOURCE-SUPPORTED", "Found in credible external documentation or reports", "At least one reliable source, no measurement"],
            ["PARTIALLY-VALIDATED", "Some experimental evidence exists", "Operator-recorded measurements with limited replicates"],
            ["EXPERIMENTALLY-CONFIRMED", "Successfully tested under documented conditions", "3+ consistent replicates with attached evidence"],
            ["INDEPENDENTLY-REPLICATED", "Reproduced in a separate experiment", "Second operator or separate session reproduces the result"],
            ["PATCHED / OBSOLETE", "Previously functional but no longer applicable", "Documented patch change invalidates the finding"],
          ].map((r) => [
            <ClassificationBadge key="c" value={r[0]} />,
            <span key="m" className="text-[12px] text-slate-300">{r[1]}</span>,
            <span key="r" className="text-[11px] text-slate-400">{r[2]}</span>,
          ])}
        />
      </Panel>
    </div>
  );
}
