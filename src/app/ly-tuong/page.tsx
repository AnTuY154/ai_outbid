import { ArrowUpRight, Glasses, HeartHandshake, Store, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lý tưởng",
  description: "OptiRise kết nối người mua với các nhà bán lẻ kính trên toàn quốc, tạo thêm lựa chọn và một kênh marketing trực tiếp cho người bán.",
  alternates: { canonical: "/ly-tuong" },
};

export default function VisionPage() {
  return (
    <main className="vision-page shell">
      <section className="vision-hero">
        <span className="eyebrow"><Glasses size={14} /> Lý tưởng của OptiRise</span>
        <h1>Một nơi để tìm <em>chiếc kính phù hợp</em>, từ những nhà bán lẻ đang thật sự làm tốt.</h1>
        <p>Chúng tôi muốn tập hợp các nhà bán lẻ kính trên khắp Việt Nam vào một điểm đến dễ tìm, dễ so sánh và minh bạch hơn — để người mua có thêm lựa chọn, còn người bán có một kênh hiện diện độc lập.</p>
        <Link href="/#bang-xep-hang" className="vision-link">Khám phá các nhà bán lẻ <ArrowUpRight size={17} /></Link>
      </section>

      <section className="vision-statement">
        <p className="vision-quote">“Kính tốt không nên khó tìm, và nhà bán tốt không nên bị chôn vùi giữa những khoản phí trung gian.”</p>
      </section>

      <section className="vision-pillars" aria-label="Ba định hướng của OptiRise">
        <article>
          <span><Store size={22} /></span>
          <h2>Một sân chung cho người bán</h2>
          <p>Nhiều nhà bán lẻ kính chất lượng hiện hoạt động rời rạc, phần lớn phụ thuộc vào sàn và các kênh bán hàng của bên khác. OptiRise tạo thêm một nơi để họ tự giới thiệu website, thương hiệu và dịch vụ của mình.</p>
        </article>
        <article>
          <span><Tags size={22} /></span>
          <h2>Chi phí hợp lý hơn</h2>
          <p>Chúng tôi tin rằng khi người bán có thêm kênh marketing trực tiếp, họ có thể chủ động hơn với chi phí tiếp cận khách hàng. Mục tiêu lâu dài là góp phần giảm những khoản phí không cần thiết và hướng tới mức giá hợp lý hơn cho người mua.</p>
        </article>
        <article>
          <span><HeartHandshake size={22} /></span>
          <h2>Nhiều lựa chọn hơn cho người mua</h2>
          <p>Người mua có một điểm bắt đầu để khám phá nhà bán lẻ kính đang hoạt động, truy cập website của họ và tự so sánh sản phẩm, mức giá, chính sách bảo hành và trải nghiệm phù hợp với nhu cầu của mình.</p>
        </article>
      </section>

      <section className="vision-note">
        <h2>Chúng tôi làm gì — và không làm gì</h2>
        <div>
          <p><strong>Chúng tôi làm:</strong> tổng hợp các nhà bán lẻ đã tự đăng ký, giúp họ có vị trí quảng cáo công khai và điều hướng người mua tới website chính thức.</p>
          <p><strong>Chúng tôi không làm:</strong> không bán kính trực tiếp, không quyết định nhà bán nào tốt nhất và không thay người mua kiểm tra giá, chất lượng hay điều kiện giao dịch.</p>
        </div>
      </section>
    </main>
  );
}
