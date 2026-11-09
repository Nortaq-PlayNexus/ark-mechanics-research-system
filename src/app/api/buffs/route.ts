import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { creatureBuffs } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { BUFFS } from "@/lib/ark";
import { analyseBuffPair, buffRelationIndex } from "@/lib/engines/synergy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const matrix = url.searchParams.get("matrix");
  const relations = await db.select().from(creatureBuffs);
  const index = buffRelationIndex();

  if (matrix) {
    const pairs: unknown[] = [];
    for (let i = 0; i < BUFFS.length; i += 1) {
      for (let j = i; j < BUFFS.length; j += 1) {
        if (i === j && BUFFS[i].scope === "self") continue;
        const verdict = analyseBuffPair(BUFFS[i], BUFFS[j]);
        pairs.push({ a: BUFFS[i].slug, b: BUFFS[j].slug, verdict });
      }
    }
    return NextResponse.json({ count: pairs.length, pairs });
  }

  return NextResponse.json({
    count: BUFFS.length,
    buffs: BUFFS.map((b) => ({
      ...b,
      relations: relations
        .filter((r) => r.buffSlug === b.slug)
        .map((r) => ({ creatureSlug: r.creatureSlug, relation: r.relation })),
      providers: index.get(b.slug)?.granted ?? [],
    })).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { a?: string; b?: string };
  const a = BUFFS.find((b) => b.slug === body.a);
  const b = BUFFS.find((x) => x.slug === body.b);
  if (!a || !b) return NextResponse.json({ error: "Unknown buff slug(s)" }, { status: 400 });
  return NextResponse.json({ a: a.slug, b: b.slug, interaction: analyseBuffPair(a, b) });
}
