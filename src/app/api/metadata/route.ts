import { NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/config";
import { extractSeoMetadata } from "@/lib/metadata";
import { getListingTotalPaid } from "@/lib/repository";

export const runtime = "nodejs";

const inputSchema = z.object({ url: z.string().trim().min(3).max(2048) });

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const metadata = await extractSeoMetadata(input.url);
    const currentTotalPaid = isDatabaseConfigured()
      ? await getListingTotalPaid(metadata.canonicalUrl)
      : 0;
    return NextResponse.json({ metadata, currentTotalPaid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể đọc thông tin website.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
