import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordVisit } from "@/lib/repository";

export const runtime = "nodejs";

const inputSchema = z.object({
  visitorId: z.string().uuid(),
  referrer: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const userAgent = request.headers.get("user-agent") ?? "";
    const userAgentHash = userAgent
      ? createHash("sha256").update(userAgent).digest("hex").slice(0, 32)
      : undefined;
    const stats = await recordVisit({ ...input, userAgentHash });
    return NextResponse.json({ stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể ghi nhận lượt truy cập.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
