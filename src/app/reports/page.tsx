import Link from "next/link";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await ensureSeeded();
  const params = await searchParams;
  const rows = await db.select().from(reports);
  const selected = rows.find((r) => r.code === params.code) ?? rows[0];

  const body = selected?.body as
    | { narrative?: string[]; sections?: { heading: string; rows: { label: string; value: string; detail?: string }[] }[] }
    | undefined;

  return (
    <div>
      <PageHeader
        kicker="Section 13 · Research Reports"
        title="Automated Research Reports"
        subtitle="Ten standing reports are generated from the live research database. Each includes methodology, testing conditions, results, limitations, confidence classifications and the sources the conclusions depend on. Reports are regenerated whenever the research cycle runs — they never contain results that were not recorded."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Reports available" value={rows.length} />
        <StatTile label="Sections total" value={rows.reduce((n, r) => n + (((r.body as { sections?: unknown[] })?.sections ?? []).length), 0)} accent="cool" />
        <StatTile label="Latest regeneration" value={selected ? new Date(selected.createdAt).toISOString().slice(0, 10) : "—"} accent="amber" />
        <StatTile label="Sources cited" value={rows.reduce((n, r) => n + (r.sourceKeys ?? []).length, 0)} accent="muted" />
        <StatTile label="Game version tag" value="live build" accent="muted" hint="record exact version per experiment" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <Panel title="Report catalogue" className="lg:col-span-1">
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.code}>
                <Link
                  href={`/reports?code=${r.code}`}
                  className={`block rounded border px-2 py-2 text-[12px] transition ${
                    selected?.code === r.code
                      ? "border-tactical/40 bg-tactical/10 text-tactical"
                      : "border-edge/60 text-slate-300 hover:border-tactical/30"
                  }`}
                >
                  <div className="data-font text-[9px] text-slate-600">{r.code}</div>
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4 lg:col-span-3">
          {selected ? (
            <>
              <Panel title={selected.code} subtitle={selected.kind}>
                <h2 className="text-xl font-semibold text-white">{selected.title}</h2>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-300">{selected.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Tag tone="cool">{selected.gameVersion}</Tag>
                  <Tag>{new Date(selected.createdAt).toISOString().slice(0, 16).replace("T", " ")}</Tag>
                </div>
              </Panel>

              <Panel title="Methodology">
                <p className="text-[12px] leading-relaxed text-slate-400">{selected.methodology}</p>
              </Panel>

              <Panel title="Testing conditions">
                <p className="text-[12px] leading-relaxed text-slate-400">{selected.testingConditions}</p>
              </Panel>

              {(body?.narrative ?? []).length > 0 ? (
                <Panel title="Narrative findings">
                  <ul className="space-y-2 text-[12px] leading-relaxed text-slate-300">
                    {(body?.narrative ?? []).map((n, i) => (
                      <li key={i}>• {n}</li>
                    ))}
                  </ul>
                </Panel>
              ) : null}

              {(body?.sections ?? []).map((section) => (
                <Panel key={section.heading} title={section.heading} subtitle={`${section.rows.length} entries`}>
                  {section.rows.length === 0 ? (
                    <p className="text-[12px] text-slate-500">No entries recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {section.rows.map((row, i) => (
                        <div key={`${row.label}-${i}`} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-[12px] font-medium text-slate-100">{row.label}</span>
                            <span className="data-font ml-auto text-[11px] text-tactical">{row.value}</span>
                          </div>
                          {row.detail ? <p className="mt-1 text-[11px] leading-snug text-slate-400">{row.detail}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              ))}

              <Panel title="Limitations">
                <ul className="space-y-1 text-[12px] leading-relaxed text-slate-400">
                  {selected.limitations.split("\n").filter(Boolean).map((l, i) => (
                    <li key={i}>• {l}</li>
                  ))}
                </ul>
                <div className="data-font mt-3 text-[10px] text-slate-600">
                  sources: {(selected.sourceKeys ?? []).join(", ")}
                </div>
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
