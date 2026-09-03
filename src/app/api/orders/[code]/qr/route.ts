import { getOrder } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const order = await getOrder(code.toUpperCase());
  if (!order?.qrUrl) return Response.json({ error: "Không tìm thấy ảnh QR cho đơn hàng này." }, { status: 404 });

  const qrResponse = await fetch(order.qrUrl, { cache: "no-store" });
  if (!qrResponse.ok || !qrResponse.body) {
    return Response.json({ error: "Không thể tải ảnh QR. Vui lòng thử lại." }, { status: 502 });
  }

  return new Response(qrResponse.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="qr-thanh-toan-${order.code}.png"`,
      "Content-Type": qrResponse.headers.get("content-type") ?? "image/png",
    },
  });
}
