import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { combinations } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { analyseCombination, type ResearchContext } from "@/lib/engines/synergy";
import { CREATURE_BY_SLUG } from "@/lib/ark";

export const dynamic = "force-dynamic";

const CONTEXTS: ResearchContext[] = ["raid-assault", "raid-defence", "boss-arena", "pvp-open", "pve-general", "logistics"];

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const context = url.searchParams.get("context") as ResearchContext | null;
  const limit = Number(url.searchParams.get("limit") ?? 40);
  const where = context && CONTEXTS.includes(context) ? eq(combinations.context, context) : undefined;
  const rows = await db
    .select()
    .from(combinations)
    .where(where ? and(where) : undefined)
    .orderBy(desc(combinations.synergyScore))
    .limit(Math.min(200, Math.max(1, limit)));
  return NextResponse.json({ count: rows.length, combinations: rows });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as { slugs?: string[]; context?: string };
  const slugs = (body.slugs ?? []).filter((s) => CREATURE_BY_SLUG.has(s));
  if (slugs.length < 2) {
    return NextResponse.json({ error: "Provide at least two known creature slugs" }, { status: 400 });
  }
  const context = (CONTEXTS.includes(body.context as ResearchContext) ? body.context : "raid-assault") as ResearchContext;
  const analysis = analyseCombination(slugs.slice(0, 8), context);
  return NextResponse.json(analysis);
}
