import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Copy, Download, ScanLine } from "lucide-react";
import { getOrder } from "@/lib/repository";
import { formatMoney } from "@/lib/format";
import { PaymentStatus } from "@/components/payment-status";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = await getOrder(code.toUpperCase());
  if (!order) notFound();

  return (
    <main className="payment-page shell">
      <div className="payment-wrap">
        <section className="payment-summary">
          <span className="eyebrow"><ScanLine size={15} /> Thanh toán SePay</span>
          <h1>Quét QR để hoàn tất.</h1>
          <p>Chuyển đúng số tiền và giữ nguyên nội dung để hệ thống tự động nhận diện giao dịch.</p>
          <div className="order-code">
            <small>NỘI DUNG CHUYỂN KHOẢN</small>
            <strong>{order.code}</strong>
          </div>
          <div className="payment-rows">
            <div><span>Số tiền</span><strong>{formatMoney(order.amount)}</strong></div>
            <div><span>Ngân hàng</span><strong>{order.bankName ?? "Chưa cấu hình"}</strong></div>
            <div><span>Số tài khoản</span><strong>{order.bankAccount ?? "Chưa cấu hình"}</strong></div>
            <div><span>Chủ tài khoản</span><strong>{order.accountName ?? "Chưa cấu hình"}</strong></div>
          </div>
          <PaymentStatus initialOrder={order} />
        </section>
        <aside className="qr-card">
          {order.qrUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.qrUrl} alt={`QR thanh toán đơn ${order.code}`} />
              <a className="download-qr" href={`/api/orders/${order.code}/qr`} download={`qr-thanh-toan-${order.code}.png`}>
                <Download size={16} /> Lưu ảnh QR
              </a>
              <small className="download-qr-hint">Trên iPhone/iPad, nếu ảnh mở ra, chọn Chia sẻ rồi “Lưu hình ảnh”.</small>
            </>
          ) : (
            <div className="qr-placeholder"><div><Copy size={30} /><p>Cấu hình tài khoản SePay để hiển thị QR.</p></div></div>
          )}
          <div className="qr-thanks">
            <p>Cảm ơn bạn đã đồng hành cùng <strong>OptiRise</strong>.</p>
            <small>Giao dịch sẽ được xác nhận tự động.</small>
          </div>
        </aside>
      </div>
    </main>
  );
}
