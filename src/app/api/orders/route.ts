import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig, isDatabaseConfigured } from "@/lib/config";
import { extractSeoMetadata } from "@/lib/metadata";
import { createOrder } from "@/lib/repository";
import { isProvinceSlug } from "@/lib/vn-provinces";

export const runtime = "nodejs";

const inputSchema = z.object({
  url: z.string().trim().min(3).max(2048),
  amount: z.number().int().min(appConfig.minimumBid).max(9_999_999_999),
  provinceSlugs: z.array(z.string().trim().refine(isProvinceSlug, "Vui lòng chọn tỉnh/thành phố hợp lệ."))
    .min(1, "Vui lòng chọn ít nhất một tỉnh/thành phố.")
    .max(34, "Bạn chỉ có thể chọn tối đa 34 tỉnh/thành phố.")
    .refine((slugs) => new Set(slugs).size === slugs.length, "Tỉnh/thành phố đang bị chọn trùng."),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình DATABASE_URL. Không thể tạo đơn hàng khi chưa kết nối cơ sở dữ liệu." },
      { status: 503 },
    );
  }

  try {
    const input = inputSchema.parse(await request.json());
    const metadata = await extractSeoMetadata(input.url);
    const order = await createOrder(metadata, input.amount, input.provinceSlugs);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo đơn hàng.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
