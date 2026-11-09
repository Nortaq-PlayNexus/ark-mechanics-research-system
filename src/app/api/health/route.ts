import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { KB_STATS } from "@/lib/ark";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      database: "connected",
      knowledgeBase: KB_STATS,
      agents: 12,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", database: "unavailable", message: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
