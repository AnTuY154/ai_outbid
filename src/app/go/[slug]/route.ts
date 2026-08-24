import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getListing, incrementListingClick } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const cookieKey = `km_click_${createHash("sha1").update(slug).digest("hex").slice(0, 12)}`;
  let destination: string | null;

  if (request.cookies.has(cookieKey)) {
    destination = (await getListing(slug))?.canonicalUrl ?? null;
  } else {
    destination = await incrementListingClick(slug);
  }

  if (!destination) return NextResponse.redirect(new URL("/", request.url));
  const response = NextResponse.redirect(destination, 302);
  response.cookies.set(cookieKey, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10,
    path: "/",
  });
  return response;
}
