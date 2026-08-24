import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const leaderboard = await getLeaderboard();
  return NextResponse.json({ leaderboard }, { headers: { "Cache-Control": "no-store" } });
}
