# Kế hoạch xây dựng Kính Mắt Leaderboard

## 1. Tổng quan sản phẩm

Website là một bảng xếp hạng trả phí dành riêng cho lĩnh vực **Kính Mắt**.

Người dùng không cần tạo tài khoản. Luồng sử dụng chính:

1. Nhập URL website hoặc trang sản phẩm.
2. Hệ thống tự đọc metadata SEO từ URL.
3. Người dùng nhập số tiền muốn thanh toán.
4. Hệ thống tạo đơn hàng và hiển thị thông tin chuyển khoản SePay.
5. SePay gửi webhook khi nhận được tiền.
6. PostgreSQL cập nhật giao dịch, listing và thứ hạng trong một transaction.
7. Supabase Realtime cập nhật bảng xếp hạng trên mọi trình duyệt đang mở.

Thứ hạng được quyết định bởi tổng số tiền đã thanh toán của từng URL.

## 2. Công nghệ sử dụng

- Next.js App Router và TypeScript.
- PostgreSQL trên Supabase.
- Supabase Realtime Postgres Changes.
- Supabase Realtime Presence.
- Drizzle ORM và Drizzle Kit.
- SePay webhook và QR chuyển khoản.
- Cheerio để đọc metadata SEO.
- Zod để kiểm tra dữ liệu đầu vào.
- Tailwind CSS.
- shadcn/ui.
- Lucide React.
- Vercel để triển khai.

Google Sheets, Upstash Redis và hệ thống tài khoản người dùng không nằm trong phạm vi phiên bản này.

## 3. Kiến trúc tổng thể

```text
Trình duyệt
    |
    v
Next.js App Router
    |-- API đọc SEO metadata
    |-- API tạo đơn hàng
    |-- Webhook SePay
    |-- API thống kê visitor
    |-- Endpoint ghi nhận click và redirect
    |
    v
Supabase PostgreSQL
    |-- listings
    |-- orders
    |-- payments
    |-- visitors
    |-- site_stats
    |-- daily_stats
    |
    v
Supabase Realtime
    |-- Leaderboard
    |-- Lượt click
    |-- Tổng visitor
    `-- Presence người đang online
```

## 4. Chức năng chính

### 4.1. Đọc thông tin SEO từ URL

Người dùng chỉ cần nhập một URL. Server tự động lấy:

- Tiêu đề từ `og:title`, sau đó fallback sang `<title>`.
- Mô tả từ `og:description`, sau đó fallback sang `meta[name="description"]`.
- Ảnh từ `og:image`.
- Favicon.
- Canonical URL.
- Tên miền.

Quy trình chuẩn hóa URL:

- Chỉ chấp nhận giao thức HTTP và HTTPS.
- Bỏ fragment.
- Loại bỏ các query tracking như `utm_*`.
- Chuẩn hóa hostname và dấu `/` cuối URL.
- Dùng canonical URL làm định danh duy nhất cho listing.

Yêu cầu an toàn khi tải metadata:

- Chặn localhost, private IP và internal network để phòng SSRF.
- Giới hạn thời gian tải khoảng 5-8 giây.
- Giới hạn kích thước response.
- Chỉ đọc response HTML.
- Giới hạn số lần redirect.

### 4.2. Tạo đơn thanh toán

Sau khi xem preview, người dùng nhập số tiền và tạo đơn hàng.

- Server tạo mã đơn duy nhất, ví dụ `KM8F24A1`.
- Lưu đơn ở trạng thái `PENDING`.
- Snapshot metadata SEO được lưu cùng đơn hàng.
- Hiển thị số tài khoản, số tiền và nội dung chuyển khoản.
- Nội dung chuyển khoản bắt buộc chứa chính xác mã đơn.
- Đơn hàng có thời gian hết hạn.

### 4.3. Xử lý webhook SePay

Endpoint webhook:

```text
POST /api/webhooks/sepay
```

Khi nhận webhook, server phải:

1. Đọc raw request body.
2. Xác minh chữ ký HMAC-SHA256.
3. Kiểm tra tài khoản nhận tiền.
4. Lấy mã đơn từ nội dung giao dịch.
5. Kiểm tra đơn tồn tại và còn hiệu lực.
6. Đối chiếu số tiền thực nhận với số tiền của đơn.
7. Kiểm tra `sepay_transaction_id` chưa được xử lý.
8. Thực hiện database transaction.

Trong database transaction:

1. Khóa đơn hàng cần xử lý.
2. Chuyển đơn từ `PENDING` sang `PAID`.
3. Tạo payment với transaction ID duy nhất.
4. Tạo listing nếu URL chưa tồn tại.
5. Nếu listing đã tồn tại, cộng thêm số tiền thanh toán.
6. Cập nhật metadata bằng snapshot mới nhất.
7. Cập nhật tổng doanh thu.

Webhook retry không được cộng tiền hai lần.

### 4.4. Bảng xếp hạng realtime

Bảng xếp hạng chỉ hiển thị listing có trạng thái `ACTIVE`.

Quy tắc sắp xếp:

```sql
ORDER BY total_paid DESC, created_at ASC, id ASC
```

- URL có tổng tiền cao hơn đứng trước.
- Nếu bằng tiền, URL được tạo trên bảng sớm hơn đứng trước; `id` là tie-break cuối để thứ tự luôn ổn định.
- Mục All đánh số hạng liên tục trên toàn bộ listing. Mỗi tỉnh/thành đánh số hạng liên tục riêng trong số listing hoạt động tại khu vực đó.
- Một listing chỉ xuất hiện một lần trong All nhưng có thể mang một thứ hạng khác ở từng tỉnh/thành đã đăng ký.
- Một URL có thể thanh toán nhiều lần.
- Mỗi khoản thanh toán thành công được cộng vào `total_paid`. Khi website đã có trên bảng, số tiền trong form là **tổng mục tiêu**; đơn thanh toán chỉ thu phần chênh giữa tổng mục tiêu và `total_paid` hiện có.

Client subscribe thay đổi `INSERT` và `UPDATE` trên bảng `listings`.

Khi webhook cập nhật listing:

- Supabase phát sự kiện realtime.
- Client cập nhật listing tương ứng hoặc tải lại leaderboard.
- Thao tác refresh nên debounce khoảng 300-500 ms.

### 4.5. Ghi nhận lượt click

Không liên kết trực tiếp listing đến website đích. Mọi click đi qua:

```text
GET /go/[slug]
```

Endpoint thực hiện:

1. Tìm listing đang hoạt động.
2. Gọi PostgreSQL function để tăng `click_count` nguyên tử.
3. Tăng `site_stats.total_outbound_clicks`.
4. Redirect `302` đến URL thật.

Supabase Realtime phát sự kiện cập nhật để số click thay đổi ngay trên giao diện.

Biện pháp chống spam:

- Dùng cookie `km_click_visitor` ẩn danh, `HttpOnly`, có hiệu lực một năm.
- PostgreSQL chỉ tính một click cho mỗi visitor và listing trong 10 giây, nguyên tử ngay cả khi chạy nhiều instance.
- Rate limit endpoint redirect: tối đa 30 yêu cầu mỗi IP trong một phút; nếu hạ tầng không cung cấp IP qua proxy header, giới hạn theo visitor cookie.
- Bỏ qua crawler và bot phổ biến theo `User-Agent` (vẫn redirect nhưng không cộng click).

### 4.6. Số người đang online

Sử dụng Supabase Realtime Presence với channel:

```text
site-presence
```

- Mỗi trình duyệt có một cookie `visitor_id` dạng UUID.
- Presence key sử dụng `visitor_id`.
- Client chỉ track presence khi tab đang hiển thị.
- Khi đóng tab hoặc mất kết nối, Supabase tự loại presence.
- Nếu một visitor mở nhiều tab, giao diện gom theo `visitor_id` và chỉ tính một người.

Hiển thị ví dụ:

```text
128 người đang online
```

### 4.7. Tổng số người truy cập

Khi người dùng truy cập website:

```text
POST /api/analytics/visit
```

Server thực hiện upsert theo `visitor_id`:

```sql
INSERT INTO visitors (...)
ON CONFLICT (visitor_id)
DO UPDATE SET last_seen_at = now();
```

- Nếu visitor chưa tồn tại, tăng `site_stats.total_visitors`.
- Mỗi lượt tải trang tăng `site_stats.total_pageviews`.
- Client subscribe `site_stats` để cập nhật số liệu realtime.
- Không lưu tên, email hoặc địa chỉ IP thô.

Một người xóa cookie hoặc sử dụng thiết bị khác có thể được tính thành visitor mới.

## 5. Thiết kế cơ sở dữ liệu

### 5.1. Bảng `listings`

| Cột | Kiểu gợi ý | Ghi chú |
| --- | --- | --- |
| `id` | `uuid` | Khóa chính |
| `canonical_url` | `text` | Unique |
| `original_url` | `text` | URL gần nhất người dùng nhập |
| `slug` | `text` | Unique |
| `domain` | `text` | Tên miền hiển thị |
| `title` | `text` | Tiêu đề SEO |
| `description` | `text` | Mô tả SEO |
| `image_url` | `text` | Ảnh Open Graph |
| `favicon_url` | `text` | Favicon |
| `total_paid` | `bigint` | Tổng tiền VND |
| `click_count` | `bigint` | Tổng lượt click |
| `first_paid_at` | `timestamptz` | Thanh toán đầu tiên |
| `last_paid_at` | `timestamptz` | Thanh toán gần nhất |
| `status` | `text` | `ACTIVE`, `HIDDEN`, `BLOCKED` |
| `created_at` | `timestamptz` | Thời gian tạo |
| `updated_at` | `timestamptz` | Thời gian cập nhật |

### 5.2. Bảng `orders`

| Cột | Kiểu gợi ý | Ghi chú |
| --- | --- | --- |
| `id` | `uuid` | Khóa chính |
| `order_code` | `text` | Unique |
| `canonical_url` | `text` | URL đã chuẩn hóa |
| `expected_amount` | `bigint` | Số tiền phải trả |
| `status` | `text` | `PENDING`, `PAID`, `EXPIRED`, `FAILED` |
| `metadata` | `jsonb` | Snapshot SEO |
| `expires_at` | `timestamptz` | Thời gian hết hạn |
| `created_at` | `timestamptz` | Thời gian tạo |
| `paid_at` | `timestamptz` | Thời gian thanh toán |

### 5.3. Bảng `payments`

| Cột | Kiểu gợi ý | Ghi chú |
| --- | --- | --- |
| `id` | `uuid` | Khóa chính |
| `order_id` | `uuid` | Tham chiếu order |
| `sepay_transaction_id` | `text` | Unique |
| `amount` | `bigint` | Số tiền thực nhận |
| `bank_account` | `text` | Tài khoản nhận |
| `transaction_content` | `text` | Nội dung chuyển khoản |
| `raw_payload` | `jsonb` | Payload để đối soát |
| `paid_at` | `timestamptz` | Thời gian giao dịch |
| `created_at` | `timestamptz` | Thời gian ghi nhận |

### 5.4. Bảng `visitors`

| Cột | Kiểu gợi ý | Ghi chú |
| --- | --- | --- |
| `id` | `uuid` | Khóa chính |
| `visitor_id` | `uuid` | Unique, lấy từ cookie |
| `first_seen_at` | `timestamptz` | Lần đầu truy cập |
| `last_seen_at` | `timestamptz` | Hoạt động gần nhất |
| `first_referrer` | `text` | Nguồn truy cập đầu tiên |
| `user_agent_hash` | `text` | Không lưu user agent thô nếu không cần |

### 5.5. Bảng `site_stats`

Chỉ có một dòng thống kê tổng:

| Cột | Kiểu gợi ý |
| --- | --- |
| `id` | `smallint` |
| `total_visitors` | `bigint` |
| `total_pageviews` | `bigint` |
| `total_outbound_clicks` | `bigint` |
| `total_revenue` | `bigint` |
| `updated_at` | `timestamptz` |

### 5.6. Bảng `daily_stats`

| Cột | Kiểu gợi ý |
| --- | --- |
| `date` | `date` |
| `unique_visitors` | `bigint` |
| `pageviews` | `bigint` |
| `outbound_clicks` | `bigint` |
| `paid_orders` | `bigint` |
| `revenue` | `bigint` |

## 6. API và route

| Method | Route | Mục đích |
| --- | --- | --- |
| `POST` | `/api/metadata` | Đọc metadata SEO từ URL |
| `POST` | `/api/orders` | Tạo đơn hàng SePay |
| `GET` | `/api/orders/[orderCode]` | Kiểm tra trạng thái đơn |
| `POST` | `/api/webhooks/sepay` | Xử lý webhook SePay |
| `POST` | `/api/analytics/visit` | Ghi visitor và pageview |
| `GET` | `/api/stats` | Trả số liệu tổng |
| `GET` | `/api/leaderboard` | Trả bảng xếp hạng |
| `GET` | `/go/[slug]` | Tăng click và redirect |

## 7. Các trang giao diện

- `/`: leaderboard Kính Mắt, form tham gia và thống kê realtime.
- `/thanh-toan/[orderCode]`: QR và trạng thái chờ thanh toán.
- `/thanh-cong/[orderCode]`: thông báo thanh toán thành công.
- `/kinh-mat/[slug]`: trang chi tiết listing.
- `/quy-dinh`: quy tắc đấu giá.
- `/dieu-khoan`: điều khoản thanh toán.
- `/chinh-sach-bao-mat`: chính sách riêng tư.

## 8. Realtime subscription

Client cần ba subscription:

### `listings`

- Nhận listing mới.
- Nhận thay đổi tổng tiền.
- Nhận thay đổi lượt click.
- Cập nhật thứ hạng.

### `site_stats`

- Tổng visitor.
- Tổng pageview.
- Tổng click ra ngoài.
- Tổng doanh thu nếu được công khai.

### `site-presence`

- Số visitor đang online.

Không subscribe công khai vào các bảng:

- `orders`.
- `payments`.
- `visitors`.

## 9. Bảo mật và Row Level Security

- Bật RLS cho tất cả bảng.
- Public chỉ được đọc listing có trạng thái `ACTIVE`.
- Public chỉ được đọc các thống kê đã xác định là công khai.
- Client không được trực tiếp tạo order hoặc payment.
- Client không được trực tiếp tăng tiền hoặc click.
- Mọi ghi dữ liệu đi qua Next.js Route Handlers.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ được sử dụng phía server.
- SePay webhook phải dùng HTTPS và HMAC-SHA256.
- `sepay_transaction_id` phải có unique constraint.
- Kiểm tra số tiền, tài khoản nhận và mã đơn trước khi xác nhận.
- Lưu raw webhook payload phục vụ đối soát.
- Rate limit các API public.
- Không hiển thị lỗi nội bộ, secret hoặc payload thanh toán cho client.

## 10. Biến môi trường dự kiến

```dotenv
NEXT_PUBLIC_APP_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

SEPAY_WEBHOOK_SECRET=
SEPAY_BANK_ACCOUNT=
SEPAY_BANK_NAME=
SEPAY_ACCOUNT_NAME=
SEPAY_PAYMENT_PREFIX=KM

MINIMUM_BID_AMOUNT=
ORDER_EXPIRY_MINUTES=
```

Không commit các giá trị thật vào Git.

## 11. Giai đoạn triển khai

### Giai đoạn 1: Nền tảng

- Khởi tạo Next.js App Router và TypeScript.
- Cài Tailwind CSS và shadcn/ui.
- Tạo Supabase project.
- Thiết lập Drizzle ORM.
- Tạo migration và indexes.
- Thiết lập RLS cơ bản.

### Giai đoạn 2: SEO metadata

- Xây URL validator và normalizer.
- Chống SSRF.
- Lấy metadata bằng Cheerio.
- Xây UI preview.
- Viết test cho các trường hợp URL lỗi.

### Giai đoạn 3: Thanh toán SePay

- Tạo order `PENDING`.
- Sinh mã thanh toán.
- Hiển thị QR và hướng dẫn chuyển khoản.
- Tạo webhook endpoint.
- Xác minh HMAC.
- Xử lý payment bằng database transaction.
- Kiểm thử webhook retry và transaction trùng.

### Giai đoạn 4: Leaderboard realtime

- Xây query xếp hạng.
- Hiển thị listing cards.
- Subscribe `listings`.
- Cập nhật thứ hạng realtime.
- Xây trang chi tiết listing.

### Giai đoạn 5: Click và visitor

- Xây redirect `/go/[slug]`.
- Tăng click bằng PostgreSQL function.
- Tạo cookie visitor ẩn danh.
- Ghi visitor và pageview.
- Subscribe `site_stats`.
- Thêm chống spam và rate limit.

### Giai đoạn 6: Online Presence

- Tạo channel `site-presence`.
- Track/untrack theo trạng thái tab.
- Gộp nhiều tab theo `visitor_id`.
- Hiển thị số online realtime.

### Giai đoạn 7: Hoàn thiện

- Dark mode và responsive.
- Metadata SEO động.
- Open Graph image.
- Sitemap và robots.txt.
- Trang quy định, điều khoản và riêng tư.
- Logging và error monitoring.
- Kiểm thử end-to-end.
- Deploy Vercel và cấu hình webhook production.

## 12. Tiêu chí hoàn thành MVP

- Người dùng chỉ cần nhập URL và số tiền.
- Metadata SEO được lấy tự động và có preview.
- Hệ thống tạo được mã đơn và QR SePay.
- Chỉ webhook hợp lệ mới kích hoạt listing.
- Webhook retry không làm tăng tiền hai lần.
- Cùng một URL có thể trả thêm tiền để tăng hạng.
- Leaderboard cập nhật realtime trên nhiều trình duyệt.
- Click được tăng nguyên tử và hiển thị realtime.
- Online Presence hoạt động khi mở và đóng tab.
- Tổng visitor và pageview được cập nhật realtime.
- Public không có quyền sửa trực tiếp dữ liệu PostgreSQL.
- Giao diện hoạt động tốt trên mobile và desktop.

