# Kính Mắt Leaderboard

Bảng xếp hạng trả phí realtime dành riêng cho các website và sản phẩm kính mắt.

## Stack

- Next.js App Router + TypeScript
- Supabase PostgreSQL + Realtime + Presence
- Drizzle ORM
- SePay webhook
- Cheerio + Zod
- Tailwind CSS

## Chạy local

```bash
npm install
cp .env.example .env.local
npm run dev
```

`DATABASE_URL` là bắt buộc. Ứng dụng chỉ đọc và ghi dữ liệu thật từ PostgreSQL; nếu thiếu biến này, API sẽ trả lỗi cấu hình thay vì hiển thị dữ liệu demo.

## Cấu hình PostgreSQL

1. Tạo Supabase project.
2. Copy connection string vào `DATABASE_URL`.
3. Chạy migration:

```bash
npm run db:migrate
```

Hoặc chạy trực tiếp file `drizzle/0000_initial.sql` trong Supabase SQL Editor.

4. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` để bật Realtime/Presence.

## Cấu hình SePay

1. Liên kết tài khoản ngân hàng trên SePay.
2. Tạo webhook loại tiền vào, content type JSON.
3. URL webhook production:

```text
https://your-domain.com/api/webhooks/sepay
```

4. Chọn xác thực HMAC-SHA256 và lưu secret vào `SEPAY_WEBHOOK_SECRET`.
5. Cấu hình tiền tố mã thanh toán giống `SEPAY_PAYMENT_PREFIX`.
6. Điền tài khoản nhận tiền vào các biến `SEPAY_BANK_*`.

Chỉ bật `SEPAY_ALLOW_UNSIGNED_WEBHOOKS=true` khi thử nghiệm local. Không sử dụng tùy chọn này ở production.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run db:generate
npm run db:migrate
```

Chi tiết thiết kế nằm trong [PLAN.md](./PLAN.md).
