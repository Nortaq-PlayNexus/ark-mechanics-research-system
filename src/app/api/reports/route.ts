import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { generateAllReports } from "@/lib/research/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const [row] = await db.select().from(reports).where(eq(reports.code, code)).limit(1);
    if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(row);
  }
  const rows = await db.select().from(reports).orderBy(asc(reports.code));
  return NextResponse.json({ count: rows.length, reports: rows });
}

export async function POST() {
  await ensureSeeded();
  const generated = await generateAllReports();
  return NextResponse.json({ ok: true, generated });
}
