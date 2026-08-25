# Hướng dẫn đăng ký dịch vụ và cấu hình production

Tài liệu này được lập từ mã nguồn hiện tại của dự án **Kính Mắt Leaderboard**. Để chạy đầy đủ luồng tạo đơn, nhận chuyển khoản và cập nhật bảng xếp hạng realtime, bạn cần chuẩn bị các dịch vụ dưới đây.

## Tóm tắt

| Dịch vụ | Có bắt buộc? | Mục đích |
| --- | --- | --- |
| Supabase | Có | PostgreSQL và Realtime/Presence cho bảng xếp hạng. |
| SePay + tài khoản ngân hàng nhận tiền | Có | Nhận thông báo giao dịch chuyển khoản qua webhook. |
| Vercel hoặc nền tảng Node.js có HTTPS | Có khi đưa lên production | Host ứng dụng Next.js và nhận webhook. |
| Tên miền + DNS | Khuyến nghị, cần nếu dùng domain riêng | Tạo URL production ổn định cho người dùng và webhook. |
| VietQR | Không | QR được tạo bằng URL ảnh công khai, không dùng API key hay tài khoản VietQR. |

Khi chỉ xem giao diện ở máy cá nhân, không cần đăng ký dịch vụ nào: trang chủ sẽ dùng dữ liệu demo nếu chưa có `DATABASE_URL`.

---

## 1. Tạo project Supabase (bắt buộc)

### Cần đăng ký/tạo

1. Đăng ký tài khoản Supabase.
2. Tạo một **Project** PostgreSQL mới. Lưu lại mật khẩu database ở nơi an toàn.
3. Chọn region gần người dùng và nền tảng deploy của bạn để giảm độ trễ.

### Lấy thông tin cần điền

Trong trang quản trị Supabase, lấy các giá trị sau và đặt vào biến môi trường của Vercel/host:

```dotenv
DATABASE_URL=                    # Connection string PostgreSQL của project
NEXT_PUBLIC_SUPABASE_URL=        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Publishable/anon key cho trình duyệt
```

`DATABASE_URL` chỉ dùng ở server để tạo đơn, ghi payment, redirect và thống kê. Không đặt biến này với tiền tố `NEXT_PUBLIC_`.

`NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` được gửi xuống trình duyệt để client lắng nghe Realtime. Đây là chủ ý của ứng dụng; vì vậy database phải được bảo vệ bằng quyền/RLS phù hợp trước khi public.

### Tạo schema và bật Realtime

Chạy migration có sẵn trong repo:

```bash
npm run db:migrate
```

Hoặc mở **SQL Editor** trong Supabase, chạy file `drizzle/0000_initial.sql`.

Migration này tạo các bảng `listings`, `orders`, `payments`, `visitors`, `site_stats`, `daily_stats`, các hàm database và thêm `listings`, `site_stats` vào publication `supabase_realtime`.

Sau đó kiểm tra trong Supabase rằng Realtime đang hoạt động với hai bảng trên. Client cần:

- `listings`: cập nhật hạng và lượt click;
- `site_stats`: cập nhật tổng lượt truy cập/doanh thu;
- channel Presence `site-presence`: số người online.

### Lưu ý bảo mật Supabase

- Chỉ public dữ liệu cần hiển thị: listing `ACTIVE` và thống kê công khai.
- Không cấp quyền public ghi trực tiếp vào `orders`, `payments`, `visitors` hoặc `site_stats`; các thao tác ghi đi qua Route Handler của Next.js.
- File `.env.example` có `SUPABASE_SERVICE_ROLE_KEY`, nhưng mã nguồn hiện tại **không sử dụng** biến này. Không cần tạo hay đưa service-role key vào host ở phiên bản hiện tại. Nếu sau này dùng, tuyệt đối không đưa key đó vào biến `NEXT_PUBLIC_*`.

### Quy trình chi tiết từng bước trên Supabase

#### Bước 1: Tạo tài khoản và organization

1. Mở [Supabase Dashboard](https://supabase.com/dashboard) và đăng ký/đăng nhập.
2. Nếu Dashboard hỏi organization, tạo một organization cho dự án; tên có thể là tên công ty hoặc tên sản phẩm.
3. Chọn **New project**.

#### Bước 2: Tạo database project

Điền các trường khi tạo project:

| Trường | Giá trị nên dùng |
| --- | --- |
| Organization | Organization vừa tạo. |
| Name | Ví dụ `kinh-mat-leaderboard-prod`. |
| Database password | Tạo mật khẩu mạnh, lưu trong password manager. Đây không phải API key và cần để lấy `DATABASE_URL`. |
| Region | Chọn region gần máy chủ deploy/Vercel và người dùng Việt Nam nhất trong các lựa chọn có sẵn. |
| Plan | Có thể bắt đầu với plan phù hợp giai đoạn thử nghiệm; xem giới hạn trước khi nhận giao dịch thật. |

Nhấn **Create new project**, rồi đợi trạng thái project sẵn sàng. Không dùng chung project này với ứng dụng không liên quan, vì migration bên dưới sẽ tạo bảng và quyền truy cập riêng cho ứng dụng.

#### Bước 3: Lấy Project URL và publishable key

Trong project đã tạo, mở **Connect** ở đầu Dashboard. Bạn cũng có thể tìm riêng các khóa tại **Settings → API Keys**.

Lấy hai giá trị sau:

1. **Project URL**, thường có dạng `https://<project-ref>.supabase.co`.
2. **Publishable key** (`sb_publishable_...`). Nếu project chỉ hiển thị khóa legacy, dùng **anon key**.

Đặt vào file `.env.local` khi chạy local hoặc Environment Variables khi deploy:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key-hoac-anon-key>
```

Tên biến `NEXT_PUBLIC_SUPABASE_ANON_KEY` được giữ để tương thích mã nguồn hiện tại, nhưng giá trị có thể là publishable key mới. Publishable/anon key được phép xuất hiện trong trình duyệt; quyền dữ liệu thực tế vẫn do RLS quyết định. Không dùng secret key hoặc service-role key tại đây.

#### Bước 4: Lấy connection string PostgreSQL

Trong **Connect**, chọn connection string phù hợp và sao chép nguyên văn; Supabase đã điền project ref và yêu cầu bạn thay đúng database password đã tạo ở Bước 2.

Với ứng dụng này:

- Deploy kiểu serverless như Vercel: ưu tiên **Transaction pooler** (cổng `6543`) cho `DATABASE_URL`.
- Server Node chạy lâu dài: dùng **Direct connection** (cổng `5432`) nếu host hỗ trợ IPv6, hoặc **Session pooler** (cổng `5432`) khi cần IPv4.
- Chạy migration: direct connection là lựa chọn lý tưởng; nếu mạng local không hỗ trợ IPv6, có thể dùng pooler. Mã nguồn đã đặt `prepare: false`, nên tương thích Transaction pooler.

Thêm vào `.env.local`:

```dotenv
DATABASE_URL=postgresql://postgres:<database-password>@<host>:<port>/postgres
```

Không commit `.env.local`, không dán connection string vào ticket/chat công khai và không thêm tiền tố `NEXT_PUBLIC_` vào `DATABASE_URL`.

#### Bước 5: Tạo tables, indexes, RLS và Realtime

Từ thư mục dự án, sau khi đã điền `DATABASE_URL`, chạy:

```bash
npm run db:migrate
```

Nếu không chạy được command local, vào **SQL Editor** trong Supabase, tạo một query mới, dán toàn bộ nội dung file `drizzle/0000_initial.sql`, rồi chọn **Run**. Chỉ chạy trên đúng project Supabase của ứng dụng.

Sau khi thành công, kiểm tra trong Table Editor có các bảng:

```text
listings, orders, payments, visitors, site_stats, daily_stats
```

Migration cũng tạo dòng thống kê ban đầu `site_stats.id = 1`, bật RLS trên tất cả bảng và chỉ cho public đọc listing `ACTIVE` cùng site stats. Không tự tạo policy cho thao tác `INSERT`, `UPDATE` hay `DELETE` từ public.

#### Bước 6: Xác minh Realtime

Migration đã thêm `listings` và `site_stats` vào publication `supabase_realtime`. Trong SQL Editor, chạy truy vấn sau để kiểm tra:

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public';
```

Kết quả phải có hai dòng `listings` và `site_stats`. Nếu thiếu vì migration bị dừng giữa chừng, chạy lại các khối `ALTER PUBLICATION` cuối file migration hoặc chạy lại toàn bộ migration; chúng đã được viết để không lỗi khi table đã tồn tại.

#### Bước 7: Kiểm tra từ ứng dụng local

1. Tạo `.env.local` với ba biến ở trên.
2. Khởi động dự án bằng `npm run dev`.
3. Mở trang chủ, nhập một URL và tạo đơn. Nếu trả lỗi `Chưa cấu hình DATABASE_URL`, kiểm tra tên biến và khởi động lại dev server.
4. Mở thêm một tab; sau khi dữ liệu thay đổi, bảng xếp hạng và thống kê phải cập nhật mà không cần tải lại trang.

Khi đưa lên Vercel, nhập lại cùng biến môi trường ở **Project Settings → Environment Variables**, redeploy, rồi thực hiện kiểm tra một lần nữa trên URL HTTPS production trước khi cấu hình SePay.

---

## 2. Tạo tài khoản SePay và kết nối ngân hàng (bắt buộc để nhận tiền)

### Cần đăng ký/tạo

1. Đăng ký tài khoản SePay.
2. Liên kết tài khoản ngân hàng sẽ nhận tiền đấu hạng.
3. Tạo webhook thông báo **tiền vào** với payload JSON.
4. Tạo/lưu một webhook secret dùng để xác minh HMAC-SHA256.

### Cấu hình webhook

Sau khi deploy, đặt URL webhook trên SePay là:

```text
https://<ten-mien-cua-ban>/api/webhooks/sepay
```

Endpoint này chỉ chấp nhận giao dịch tiền vào, kiểm tra số tài khoản nhận, mã đơn, số tiền và mã giao dịch trước khi cộng tiền vào bảng xếp hạng. URL phải dùng HTTPS công khai; `localhost` không nhận được webhook thật.

Trong phần xác thực webhook của SePay, bật HMAC-SHA256 và dùng secret tương ứng cho biến sau:

```dotenv
SEPAY_WEBHOOK_SECRET=
SEPAY_BANK_ACCOUNT=              # Số tài khoản nhận tiền, chỉ gồm số nếu có thể
SEPAY_BANK_NAME=Vietcombank      # Tên/mã ngân hàng mà VietQR hỗ trợ
SEPAY_ACCOUNT_NAME=              # Tên chủ tài khoản để hiển thị cho người trả tiền
SEPAY_PAYMENT_PREFIX=KM          # Phải trùng tiền tố mã đơn được SePay gửi lại
SEPAY_ALLOW_UNSIGNED_WEBHOOKS=false
```

`SEPAY_PAYMENT_PREFIX` mặc định là `KM`; mã đơn có dạng `KM...`. Không đổi tiền tố ở một bên mà quên đổi bên còn lại, vì webhook sẽ không tìm thấy đơn cần thanh toán.

Chỉ đặt `SEPAY_ALLOW_UNSIGNED_WEBHOOKS=true` khi test local không có secret. Production phải để `false` và luôn có `SEPAY_WEBHOOK_SECRET`.

### Lấy thông tin trên SePay: hướng dẫn từng bước

#### 1. Chuẩn bị trước khi tạo webhook

Bạn cần có đủ ba điều kiện sau:

1. Tài khoản SePay đã được đăng ký và xác minh theo yêu cầu của SePay.
2. Ít nhất một tài khoản ngân hàng đã được liên kết trong SePay; đây là tài khoản thực sự nhận tiền từ người trả hạng.
3. Website đã deploy tại một URL HTTPS công khai. Ví dụ: `https://kinhmat.example.com`. SePay không chấp nhận `localhost`, IP private hoặc HTTP không có SSL.

Trong lúc phát triển local, không tạo webhook production trỏ vào `localhost`. Hãy deploy lên VM/domain trước, hoặc dùng một tunnel HTTPS tạm thời để thử nghiệm.

#### 2. Thu thập thông tin tài khoản nhận tiền

Trong SePay, vào mục quản lý **Tài khoản ngân hàng**. Chọn đúng tài khoản sẽ nhận chuyển khoản và ghi lại:

| Thông tin cần có | Điền vào project | Cách ghi |
| --- | --- | --- |
| Số tài khoản nhận tiền | `SEPAY_BANK_ACCOUNT` | Chỉ dùng chữ số, bỏ khoảng trắng/dấu chấm. |
| Tên ngân hàng | `SEPAY_BANK_NAME` | Dùng đúng tên/mã ngân hàng mà URL QR VietQR nhận; ví dụ `Vietcombank`. |
| Tên chủ tài khoản | `SEPAY_ACCOUNT_NAME` | Ghi đúng tên hiển thị để người trả tiền đối chiếu. |

Ví dụ cấu hình (không dùng các giá trị ví dụ này cho tài khoản thật):

```dotenv
SEPAY_BANK_ACCOUNT=0123456789
SEPAY_BANK_NAME=Vietcombank
SEPAY_ACCOUNT_NAME=NGUYEN VAN A
```

#### 3. Tạo webhook tiền vào

Trong SePay, vào **Webhooks** → **Thêm webhook**. Form thường gồm bốn bước. Điền như sau:

**Bước 1 — Thông tin cơ bản**

| Trường SePay | Giá trị cho dự án |
| --- | --- |
| Tên webhook | Ví dụ `Kinh Mat Leaderboard - Production`. |
| Sự kiện | Chọn **Có tiền vào** (`In_only`), không chọn tiền ra. |
| Webhook URL | `https://<domain>/api/webhooks/sepay` |

**Bước 2 — Tài khoản và bộ lọc**

- Chọn đúng một tài khoản ngân hàng ở Bước 2.
- Nếu SePay có bộ lọc theo tiền tố mã thanh toán, thêm `KM` — giá trị này phải trùng `SEPAY_PAYMENT_PREFIX=KM` trong project.
- Không bật tùy chọn bỏ qua giao dịch thiếu mã thanh toán (`skip if no code`) trừ khi bạn hiểu rõ quy tắc SePay đang dùng: code của dự án vẫn có thể được đọc từ nội dung chuyển khoản.
- Không chọn tài khoản ảo/VA nếu dự án nhận tiền vào tài khoản chính thông thường.

**Bước 3 — Bảo mật**

| Trường SePay | Giá trị bắt buộc |
| --- | --- |
| Phương thức xác thực | **HMAC-SHA256**. |
| Secret Key | Tự tạo chuỗi dài ngẫu nhiên hoặc dùng chức năng tạo tự động của SePay. |
| Content type | **JSON** (`Json` trong SePay). |
| Verify payment | Bật (`1`) nếu SePay hiển thị tùy chọn này. |

Ngay sau khi lưu, copy Secret Key vào biến môi trường server:

```dotenv
SEPAY_WEBHOOK_SECRET=<secret-key-cua-webhook>
```

SePay chỉ hiển thị đầy đủ secret một lần. Không đưa secret vào Git, `NEXT_PUBLIC_*`, ảnh chụp màn hình hoặc chat. Nếu mất hoặc nghi lộ, tạo secret mới trên SePay rồi cập nhật biến môi trường trên server/VM.

**Bước 4 — Cảnh báo (khuyến nghị)**

- Bật cảnh báo sau `3` lần gửi lỗi liên tiếp.
- Chọn nhận cảnh báo qua Email, Telegram, Slack hoặc Discord nếu doanh nghiệp đã dùng kênh đó.
- Bật thông báo phục hồi nếu có, để biết webhook đã hoạt động lại.

#### 4. Đưa giá trị vào server

Trên VM, thêm các biến này vào file môi trường mà service Next.js sử dụng; trên Vercel, thêm trong **Project Settings → Environment Variables**:

```dotenv
SEPAY_WEBHOOK_SECRET=<secret-hmac-da-tao>
SEPAY_BANK_ACCOUNT=<so-tai-khoan-khong-khoang-trang>
SEPAY_BANK_NAME=<ten-ngan-hang-vietqr>
SEPAY_ACCOUNT_NAME=<ten-chu-tai-khoan>
SEPAY_PAYMENT_PREFIX=KM
SEPAY_ALLOW_UNSIGNED_WEBHOOKS=false
```

Khởi động lại ứng dụng sau khi đổi biến môi trường. Endpoint của dự án xác minh chữ ký từ `X-SePay-Signature` và `X-SePay-Timestamp`, theo đúng chuỗi HMAC `{timestamp}.{raw_body}`; vì vậy phải chọn HMAC-SHA256 và JSON như trên.

#### 5. Gửi thử ngay trong SePay

Mở webhook vừa tạo và chọn **Gửi thử** (test send) nếu Dashboard hiển thị nút này.

Kết quả đúng:

1. SePay ghi delivery thành công với HTTP `200`.
2. Server không trả `401 Invalid signature`.
3. Không có listing hoặc payment thật được tạo từ payload thử nghiệm không hợp lệ; đây là bình thường nếu payload test không khớp một order thật.

Nếu SePay trả lỗi, xem Delivery Logs của webhook trước. SePay có thể retry tự động khi endpoint không trả 2xx, nên database của dự án dùng `sepay_transaction_id` unique để một giao dịch không được cộng tiền hai lần.

### Kiểm thử trước khi mở bán

1. Tạo một đơn từ website.
2. Chuyển đúng số tiền, với nội dung chứa nguyên mã đơn hiển thị trên trang thanh toán.
3. Kiểm tra SePay gửi HTTP 200 tới webhook.
4. Kiểm tra đơn chuyển thành `PAID`, listing xuất hiện/tăng tiền và bảng xếp hạng cập nhật.
5. Gửi lại cùng webhook hoặc kiểm tra retry để chắc chắn không cộng tiền hai lần.

---

## 3. Triển khai ứng dụng có HTTPS (bắt buộc khi production)

Kế hoạch dự án chọn Vercel, nhưng mã nguồn là Next.js chuẩn và có thể chạy trên bất kỳ host Node.js nào hỗ trợ Route Handlers, kết nối PostgreSQL outbound và endpoint HTTPS công khai.

### Lựa chọn khuyến nghị: Vercel

1. Đăng ký Vercel và kết nối repository Git của dự án.
2. Tạo Project, chọn framework Next.js.
3. Trong **Project Settings → Environment Variables**, nhập các biến ở phần Supabase, SePay và phần cấu hình chung bên dưới.
4. Deploy. Lấy URL `https://...vercel.app` được tạo để thử webhook trước khi gắn domain riêng.

Các Route Handler đọc metadata SEO và webhook đặt `runtime = "nodejs"`; đừng chọn môi trường chỉ hỗ trợ static hosting.

### Biến môi trường chung

```dotenv
NEXT_PUBLIC_APP_URL=https://<ten-mien-cua-ban>
MINIMUM_BID_AMOUNT=50000
ORDER_EXPIRY_MINUTES=30
```

`NEXT_PUBLIC_APP_URL` phải chính xác với domain production, không có dấu `/` cuối. Nó được dùng cho metadata của website và để xác định URL công khai cần khai báo cho SePay.

---

## 4. Mua/gắn tên miền và cấu hình DNS (khuyến nghị)

Bạn có thể mua domain ở bất kỳ nhà đăng ký nào. Khi dùng Vercel:

1. Thêm domain vào Vercel Project.
2. Vercel sẽ cung cấp bản ghi DNS cần tạo tại nhà đăng ký domain (A hoặc CNAME, tùy domain).
3. Chờ DNS xác thực và HTTPS được cấp.
4. Cập nhật `NEXT_PUBLIC_APP_URL` thành domain đó.
5. Cập nhật URL webhook SePay sang domain mới.

Không đổi domain mà chưa cập nhật cả `NEXT_PUBLIC_APP_URL` lẫn URL webhook, vì metadata/share link và thanh toán có thể trỏ sai địa chỉ.

---

## Những dịch vụ chưa cần đăng ký

Mã nguồn hiện không tích hợp các dịch vụ sau, nên chưa cần mở tài khoản cho MVP:

- hệ thống đăng nhập/auth;
- dịch vụ email/SMS;
- Google Analytics hoặc công cụ analytics ngoài (visitor và click được lưu trong PostgreSQL);
- Redis/rate-limit bên thứ ba;
- dịch vụ lưu trữ ảnh/file (ảnh và favicon là URL từ website người dùng nhập);
- OpenAI, dịch vụ AI hoặc OCR;
- VietQR API key/tài khoản.

## Checklist trước khi public

- [ ] Supabase project đã tạo, migration đã chạy và Realtime cho `listings`, `site_stats` hoạt động.
- [ ] Quyền database/RLS đã chặn public ghi trực tiếp.
- [ ] SePay đã liên kết đúng tài khoản ngân hàng và webhook HMAC-SHA256 đã xác thực.
- [ ] Website có URL HTTPS công khai.
- [ ] Toàn bộ biến môi trường đã được điền trên host, không commit file `.env.local`.
- [ ] `NEXT_PUBLIC_APP_URL` và URL webhook SePay dùng đúng domain production.
- [ ] Đã thực hiện ít nhất một giao dịch thử end-to-end.
