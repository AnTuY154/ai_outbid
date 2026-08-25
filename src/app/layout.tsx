import type { Metadata } from "next";
import Link from "next/link";
import { Glasses } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kính Mắt — Ai trả cao, người đó đứng đầu",
  description: "Bảng xếp hạng công khai dành riêng cho các thương hiệu và sản phẩm kính mắt.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "Kính Mắt Leaderboard",
    description: "Khám phá những website kính mắt đang dẫn đầu bảng xếp hạng.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <header className="site-header">
          <div className="board-shell header-inner">
            <Link href="/" className="brand" aria-label="Kính Mắt - Trang chủ">
              <span className="brand-mark" aria-hidden="true"><Glasses size={21} strokeWidth={2.6} /></span>
              <span>kinhmat<span className="brand-dot">.rank</span></span>
            </Link>
            <div className="ranking-mode" aria-label="Chế độ xếp hạng">
              <span className="ranking-mode-active">Toàn thời gian</span>
              <span>Realtime</span>
            </div>
            <nav aria-label="Điều hướng chính">
              <Link href="/#bang-xep-hang">Xếp hạng</Link>
              <Link href="/#tham-gia">Đặt hạng</Link>
              <Link href="/quy-dinh">Quy định</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="board-shell footer-inner">
            <p>kinhmat.rank · Bảng xếp hạng trả phí minh bạch</p>
            <div>
              <Link href="/quy-dinh">Quy định</Link>
              <Link href="/dieu-khoan">Điều khoản</Link>
              <Link href="/chinh-sach-bao-mat">Riêng tư</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
