import type { Metadata } from "next";
import Link from "next/link";
import { CookieConsentBanner } from "@/components/cookie-consent";
import { HeaderLiveStats } from "@/components/header-live-stats";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OptiRise | Cửa hàng kính mắt trên toàn quốc",
    template: "%s | OptiRise",
  },
  description: "Khám phá các cửa hàng kính mắt và nhà bán lẻ kính trên toàn quốc. So sánh lựa chọn và truy cập trực tiếp website chính thức của từng nhà bán.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  alternates: { canonical: "/" },
  icons: {
    icon: "/optirise-logo.png",
    apple: "/optirise-logo.png",
  },
  openGraph: {
    title: "OptiRise | Cửa hàng kính mắt trên toàn quốc",
    description: "Khám phá các nhà bán lẻ kính đang hoạt động trên toàn quốc.",
    type: "website",
    locale: "vi_VN",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <header className="site-header">
          <div className="board-shell header-inner">
            <Link href="/" className="brand" aria-label="OptiRise - Trang chủ">
              <span className="brand-mark" aria-hidden="true"><img src="/optirise-logo.png" alt="" /></span>
              <span>Opti<span className="brand-dot">Rise</span></span>
            </Link>
            <HeaderLiveStats />
            <nav aria-label="Điều hướng chính">
              <Link href="/#bang-xep-hang">Xếp hạng</Link>
              <Link href="/#tham-gia">Đặt hạng</Link>
              <Link href="/ly-tuong" className="nav-ideal">Lý tưởng</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="board-shell footer-inner">
            <div className="footer-intro">
              <strong>Opti<span>Rise</span></strong>
              <p>Khám phá và so sánh các nhà bán lẻ kính trên toàn quốc.</p>
            </div>
            <nav className="footer-nav" aria-label="Thông tin pháp lý">
              <span>Thông tin</span>
              <div>
                <Link href="/quy-dinh">Quy định</Link>
                <Link href="/dieu-khoan">Điều khoản</Link>
                <Link href="/chinh-sach-bao-mat">Chính sách riêng tư</Link>
              </div>
            </nav>
          </div>
          <div className="board-shell footer-bottom">
            <span>© 2026 OptiRise</span>
            <Link href="/#tham-gia">Đặt hạng cửa hàng</Link>
          </div>
        </footer>
        <CookieConsentBanner />
        <a
          className="builder-badge"
          href="https://www.facebook.com/antuy1504/?locale=vi_VN"
          target="_blank"
          rel="noreferrer"
          aria-label="Xem Facebook của @antuy1504"
        >
          <span className="builder-badge-copy">Built by <strong>@antuy1504</strong></span>
          <span className="builder-badge-avatar" aria-hidden="true">AT</span>
        </a>
      </body>
    </html>
  );
}
