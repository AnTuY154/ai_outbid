import { NextResponse } from "next/server";
import { getPublicStats } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getPublicStats();
  return NextResponse.json({ stats }, { headers: { "Cache-Control": "no-store" } });
}
