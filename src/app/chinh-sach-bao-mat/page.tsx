export default function PrivacyPage() {
  return (
    <main className="legal-page shell">
      <article>
        <span className="eyebrow">Pháp lý</span>
        <h1>Chính sách riêng tư</h1>
        <p>Website sử dụng một visitor ID ngẫu nhiên trong trình duyệt để đếm visitor và số người online. ID này không chứa tên, email hoặc thông tin định danh trực tiếp.</p>
        <h2>Dữ liệu được lưu</h2>
        <ul>
          <li>URL và metadata SEO công khai của website được đăng.</li>
          <li>Thông tin giao dịch cần thiết để xác nhận thanh toán và chống xử lý trùng.</li>
          <li>Số lượt xem, lượt click và thời điểm hoạt động gần nhất của visitor ID.</li>
        </ul>
        <h2>Dữ liệu thanh toán</h2>
        <p>Giao dịch chuyển khoản được phát hiện qua SePay. Website không thu thập số thẻ hoặc mật khẩu ngân hàng.</p>
      </article>
    </main>
  );
}
