import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig, isDatabaseConfigured } from "@/lib/config";
import { extractSeoMetadata } from "@/lib/metadata";
import { createOrder } from "@/lib/repository";

export const runtime = "nodejs";

const inputSchema = z.object({
  url: z.string().trim().min(3).max(2048),
  amount: z.number().int().min(appConfig.minimumBid).max(999_999_999),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình DATABASE_URL. Không thể tạo đơn hàng khi chưa kết nối cơ sở dữ liệu." },
      { status: 503 },
    );
  }

  try {
    const input = inputSchema.parse(await request.json());
    const metadata = await extractSeoMetadata(input.url);
    const order = await createOrder(metadata, input.amount);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo đơn hàng.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
