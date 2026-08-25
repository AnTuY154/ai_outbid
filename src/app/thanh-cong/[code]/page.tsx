import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getOrder } from "@/lib/repository";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SuccessPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = await getOrder(code.toUpperCase());
  if (!order || order.status !== "PAID") notFound();

  return (
    <main className="legal-page shell">
      <article style={{ textAlign: "center", marginInline: "auto" }}>
        <CheckCircle2 size={64} color="#173f34" />
        <h1>Thanh toán thành công.</h1>
        <p>{order.metadata.title} đã được thêm hoặc tăng hạng. Bảng xếp hạng đã cập nhật realtime.</p>
        <Link href="/#bang-xep-hang" className="primary-link">Xem bảng xếp hạng</Link>
      </article>
    </main>
  );
}
