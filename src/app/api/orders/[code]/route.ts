import { NextResponse } from "next/server";
import { getListingRank, getOrder } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const order = await getOrder(code.toUpperCase());
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  const rank = order.status === "PAID" ? await getListingRank(order.metadata.domain) : null;
  return NextResponse.json({ order, rank }, { headers: { "Cache-Control": "no-store" } });
}
