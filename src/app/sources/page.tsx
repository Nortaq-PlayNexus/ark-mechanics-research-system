import { db } from "@/db";
import { citations, patchHistory, sources } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { DataTable, Meter, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  await ensureSeeded();
  const [sourceRows, patchRows, citationRows] = await Promise.all([
    db.select().from(sources),
    db.select().from(patchHistory),
    db.select().from(citations),
  ]);

  const byType = sourceRows.reduce<Record<string, number>>((acc, s) => {
    acc[s.sourceType] = (acc[s.sourceType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        kicker="Section 12 · Evidence & Sources"
        title="Source Registry, Reliability & Patch History"
        subtitle="Every knowledge-base claim carries source keys. Reliability is scored from 1 (anecdotal forum report) to 5 (primary patch notes). Community sources are treated as hypothesis-grade evidence only: they generate experiments, never conclusions."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Sources registered" value={sourceRows.length} />
        <StatTile label="High reliability (4-5)" value={sourceRows.filter((s) => s.reliability >= 4).length} accent="cool" />
        <StatTile label="Community sources" value={sourceRows.filter((s) => s.reliability <= 2).length} accent="amber" />
        <StatTile label="Patch records" value={patchRows.length} accent="muted" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(byType).map(([type, count]) => (
          <StatTile key={type} label={type} value={count} accent="muted" />
        ))}
      </div>

      <Panel title="Source registry" subtitle="reliability-rated" className="mt-4">
        <DataTable
          head={["Key", "Title", "Publisher", "Type", "Reliability", "Version", "Notes"]}
          rows={sourceRows.map((s) => [
            <span key="k" className="data-font text-[10px] text-slate-500">{s.key}</span>,
            <a key="t" href={s.url ?? "#"} target="_blank" rel="noreferrer" className="text-[12px] text-slate-200 hover:text-tactical">
              {s.title}
            </a>,
            <span key="p" className="text-[11px] text-slate-400">{s.publisher}</span>,
            <Tag key="ty" tone={s.sourceType === "patch-notes" ? "tactical" : s.sourceType === "community" ? "amber" : "cool"}>
              {s.sourceType}
            </Tag>,
            <div key="r" className="w-24">
              <Meter label={`${s.reliability}/5`} value={s.reliability} max={5} tone={s.reliability >= 4 ? "tactical" : "amber"} />
            </div>,
            <span key="v" className="data-font text-[10px] text-slate-400">{s.versionTag}</span>,
            <span key="n" className="text-[11px] leading-snug text-slate-400">{s.notes}</span>,
          ])}
        />
      </Panel>

      <Panel title="Patch history relevant to mechanics" className="mt-4">
        <DataTable
          head={["Version", "Released", "Title", "Notes", "Impact"]}
          rows={patchRows.map((p) => [
            <span key="v" className="data-font text-[11px] text-tactical">{p.version}</span>,
            <span key="r" className="data-font text-[11px] text-slate-400">{p.released}</span>,
            <span key="t" className="text-[12px] text-slate-200">{p.title}</span>,
            <span key="n" className="text-[11px] leading-snug text-slate-400">{p.notes}</span>,
            <div key="i" className="flex flex-wrap gap-1">
              {(p.impactTags ?? []).map((t) => (
                <Tag key={t} tone="amber">
                  {t}
                </Tag>
              ))}
            </div>,
          ])}
        />
      </Panel>

      <Panel title="Evidence integrity policy" className="mt-4">
        <ul className="space-y-2 text-[12px] leading-relaxed text-slate-400">
          <li>• Knowledge-base values are labelled documented, community-reported or needs-verification, and downstream claims inherit the weakest label in their chain.</li>
          <li>• Where no numeric magnitude is documented, the platform records an unknown and excludes it from all arithmetic.</li>
          <li>• Screenshots and video evidence can only be attached through the Experiment Manager by an operator who recorded them — the platform generates none itself.</li>
          <li>• Recorded citations: {citationRows.length}. Every discovery lists the source keys it depends on.</li>
        </ul>
      </Panel>
    </div>
  );
}
