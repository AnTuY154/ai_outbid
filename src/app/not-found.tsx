import Link from "next/link";

export default function NotFound() {
  return (
    <main className="legal-page shell">
      <article style={{ textAlign: "center", marginInline: "auto" }}>
        <span className="eyebrow">404</span>
        <h1>Không tìm thấy trang.</h1>
        <p>Liên kết có thể đã hết hạn hoặc listing không còn hoạt động.</p>
        <Link href="/" className="primary-link">Về trang chủ</Link>
      </article>
    </main>
  );
}
