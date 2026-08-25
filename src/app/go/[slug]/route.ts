import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { consumeClickRateLimit, getListing, registerListingClick } from "@/lib/repository";

export const runtime = "nodejs";

const CLICK_VISITOR_COOKIE = "km_click_visitor";
const BOT_USER_AGENT = /(?:bot\b|crawler|spider|slurp|archiver|facebookexternalhit|facebookcatalog|preview|prerender|headless|lighthouse|wget|curl)/i;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getRateLimitIdentity(request: NextRequest, visitorId: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || `visitor:${visitorId}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const userAgent = request.headers.get("user-agent") ?? "";
  const isBot = BOT_USER_AGENT.test(userAgent);
  const existingVisitorId = request.cookies.get(CLICK_VISITOR_COOKIE)?.value;
  const visitorId = existingVisitorId || randomUUID();
  let destination: string | null = null;

  if (isBot) {
    destination = (await getListing(slug))?.canonicalUrl ?? null;
  } else {
    const allowed = await consumeClickRateLimit(hash(getRateLimitIdentity(request, visitorId)));
    if (!allowed) {
      return NextResponse.json(
        { error: "Bạn đã click quá nhiều lần. Vui lòng thử lại sau một phút." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    destination = await registerListingClick(slug, hash(visitorId));
  }

  if (!destination) return NextResponse.redirect(new URL("/", request.url));
  const response = NextResponse.redirect(destination, 302);
  if (!existingVisitorId) {
    response.cookies.set(CLICK_VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return response;
}
