import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
  "trk",
  "igsh",
  "igshid",
  "mibextid",
  "si",
]);

const SOCIAL_HOST_ALIASES: Record<string, string> = {
  "facebook.com": "facebook.com",
  "m.facebook.com": "facebook.com",
  "mbasic.facebook.com": "facebook.com",
  "instagram.com": "instagram.com",
  "m.instagram.com": "instagram.com",
  "tiktok.com": "tiktok.com",
  "m.tiktok.com": "tiktok.com",
  "vm.tiktok.com": "tiktok.com",
  "youtube.com": "youtube.com",
  "m.youtube.com": "youtube.com",
  "linkedin.com": "linkedin.com",
  "zalo.me": "zalo.me",
  "threads.net": "threads.net",
  "x.com": "x.com",
  "twitter.com": "x.com",
};

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isPrivateIp(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export function parsePublicUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) throw new Error("URL không hợp lệ.");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Chỉ hỗ trợ URL HTTP hoặc HTTPS.");
  }
  if (url.username || url.password) throw new Error("URL không được chứa thông tin đăng nhập.");
  if (!url.hostname || url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("Tên miền không được phép.");
  }

  return url;
}

export function normalizeUrl(input: string) {
  const url = parsePublicUrl(input);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function normalizeSocialUrl(input: string) {
  const url = parsePublicUrl(input);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const canonicalHost = SOCIAL_HOST_ALIASES[hostname];
  if (!canonicalHost) return null;

  url.hostname = canonicalHost;
  return normalizeUrl(url.toString());
}

export async function assertPublicDestination(url: URL) {
  if (isIP(url.hostname) && isPrivateIp(url.hostname)) {
    throw new Error("Địa chỉ mạng nội bộ không được phép.");
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Không thể phân giải tên miền.");
  }

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("Tên miền trỏ đến địa chỉ không được phép.");
  }
}
