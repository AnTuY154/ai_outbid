import { load } from "cheerio";
import type { SeoMetadata } from "./types";
import { assertPublicDestination, normalizeSocialUrl, normalizeUrl, parsePublicUrl } from "./url-security";

const MAX_HTML_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

function absoluteUrl(value: string | undefined, base: URL) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchHtml(initialUrl: URL) {
  let currentUrl = initialUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicDestination(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "KinhMatLeaderboardBot/1.0 (+metadata preview)",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Website chuyển hướng không hợp lệ.");
        currentUrl = parsePublicUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) throw new Error(`Website phản hồi HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        throw new Error("URL không trả về trang HTML.");
      }

      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_HTML_BYTES) throw new Error("Trang HTML quá lớn.");

      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_HTML_BYTES) throw new Error("Trang HTML quá lớn.");
      return { html: new TextDecoder().decode(bytes), finalUrl: currentUrl };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Website chuyển hướng quá nhiều lần.");
}

export async function extractSeoMetadata(input: string): Promise<SeoMetadata> {
  const original = parsePublicUrl(input);
  const { html, finalUrl } = await fetchHtml(original);
  const $ = load(html);

  const property = (name: string) =>
    $(`meta[property="${name}"]`).first().attr("content")?.trim() || undefined;
  const named = (name: string) =>
    $(`meta[name="${name}"]`).first().attr("content")?.trim() || undefined;

  const title = property("og:title") || named("twitter:title") || $("title").first().text().trim();
  const description =
    property("og:description") || named("twitter:description") || named("description") || "";
  const canonicalCandidate = absoluteUrl($("link[rel='canonical']").first().attr("href"), finalUrl);
  let canonicalSource = finalUrl.toString();
  if (canonicalCandidate) {
    const candidate = parsePublicUrl(canonicalCandidate);
    const candidateHost = candidate.hostname.toLowerCase().replace(/^www\./, "");
    const finalHost = finalUrl.hostname.toLowerCase().replace(/^www\./, "");
    if (candidateHost === finalHost) canonicalSource = candidate.toString();
  }
  // Social platforms can publish a generic canonical URL for different
  // profiles. Keep the submitted account path or ID as the listing identity.
  const canonicalUrl = normalizeSocialUrl(original.toString()) || normalizeUrl(canonicalSource);
  const canonical = new URL(canonicalUrl);
  const imageUrl = absoluteUrl(property("og:image") || named("twitter:image"), finalUrl);
  const faviconUrl = absoluteUrl(
    $("link[rel~='icon']").first().attr("href") || "/favicon.ico",
    finalUrl,
  );

  return {
    originalUrl: original.toString(),
    canonicalUrl,
    domain: canonical.hostname,
    title: title.slice(0, 180) || canonical.hostname,
    description: description.slice(0, 500),
    imageUrl,
    faviconUrl,
  };
}
