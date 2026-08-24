export default function RulesPage() {
  return (
    <main className="legal-page shell">
      <article>
        <span className="eyebrow">Thông tin công khai</span>
        <h1>Quy định xếp hạng</h1>
        <h2>Cách xếp hạng</h2>
        <ul>
          <li>Thứ hạng dựa trên tổng số tiền đã thanh toán thành công cho mỗi URL.</li>
          <li>Cùng một URL có thể thanh toán nhiều lần để tăng tổng giá thầu.</li>
          <li>Nếu hai URL bằng tiền, URL thanh toán lần đầu sớm hơn đứng trước.</li>
          <li>Chỉ webhook SePay hợp lệ mới kích hoạt hoặc tăng hạng listing.</li>
        </ul>
        <h2>Nội dung được phép</h2>
        <ul>
          <li>Website phải liên quan đến kính mắt, gọng kính, kính râm hoặc dịch vụ nhãn khoa phù hợp.</li>
          <li>Không chấp nhận malware, lừa đảo, nội dung vi phạm pháp luật hoặc xâm phạm quyền của bên khác.</li>
          <li>Ban quản trị có quyền ẩn hoặc khóa listing vi phạm.</li>
        </ul>
      </article>
    </main>
  );
}
