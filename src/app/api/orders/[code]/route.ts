import { NextResponse } from "next/server";
import { getListingRanking, getOrder } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const order = await getOrder(code.toUpperCase());
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  const ranking = order.status === "PAID" ? await getListingRanking(order.metadata.canonicalUrl) : null;
  return NextResponse.json({ order, ranking }, { headers: { "Cache-Control": "no-store" } });
}
