import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Security & validation helpers for remote public dataset URLs (SSRF + DNS-rebinding prevention).
 */

export function isBlockedIpAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!normalized) return true;

  if (normalized.startsWith("::ffff:")) {
    const mappedV4 = normalized.slice("::ffff:".length);
    if (isIP(mappedV4) === 4) {
      return isBlockedIpAddress(mappedV4);
    }
    return true;
  }

  const version = isIP(normalized);
  if (version === 4) {
    const parts = normalized.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    return (
      a === 0 || // 0.0.0.0/8 "this network"
      a === 10 || // 10.0.0.0/8 private
      a === 127 || // 127.0.0.0/8 loopback
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
      (a === 169 && b === 254) || // 169.254.0.0/16 link-local & cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
      (a === 192 && b === 168) || // 192.168.0.0/16 private
      (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
      a >= 224 // multicast & reserved
    );
  }

  if (version === 6) {
    return (
      normalized === "::1" ||
      normalized === "::" ||
      /^fe[89ab][0-9a-f]:/i.test(normalized) || // link-local fe80::/10
      /^f[cd][0-9a-f]{2}:/i.test(normalized) || // unique local fc00::/7
      normalized.startsWith("ff") // multicast
    );
  }

  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!lower) return true;
  if (isIP(lower) !== 0) {
    return isBlockedIpAddress(lower);
  }
  return (
    lower === "localhost" ||
    lower === "metadata.google.internal" ||
    lower === "metadata" ||
    lower.includes("::ffff:") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".localhost") ||
    /^\d+$/.test(lower)
  );
}

export function validatePublicDatasetUrl(
  rawUrl: unknown
): { valid: true; url: URL } | { valid: false; error: string } {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "A valid https:// URL is required." };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return { valid: false, error: "Credentials in URLs are not allowed." };
  }

  if (parsedUrl.port && parsedUrl.port !== "443") {
    return { valid: false, error: "Only standard HTTPS port 443 is allowed." };
  }

  if (parsedUrl.protocol !== "https:" || isBlockedHostname(parsedUrl.hostname)) {
    return { valid: false, error: "Only public https:// dataset URLs are allowed." };
  }

  return { valid: true, url: parsedUrl };
}

/**
 * Resolves DNS A/AAAA records server-side to block DNS-rebinding SSRF attacks
 * (e.g. external domains resolving to 127.0.0.1 or 169.254.169.254).
 */
export async function assertPublicResolvableHost(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) {
    throw new Error("Blocked private or internal hostname.");
  }
  if (isIP(hostname.replace(/^\[|\]$/g, "")) !== 0) {
    return;
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records || records.length === 0) {
    throw new Error("Unable to resolve dataset hostname.");
  }
  for (const rec of records) {
    if (isBlockedIpAddress(rec.address)) {
      throw new Error("Resolved destination IP is inside a restricted network range.");
    }
  }
}

export function isValidIsoDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());
}

export function isAllowedDatasetMimeType(contentTypeHeader: string | null): boolean {
  if (!contentTypeHeader) return true;
  const mime = contentTypeHeader.split(";")[0].trim().toLowerCase();
  return (
    mime === "text/csv" ||
    mime === "text/plain" ||
    mime === "text/tab-separated-values" ||
    mime === "text/markdown" ||
    mime === "application/json" ||
    mime === "application/csv" ||
    mime === "application/octet-stream"
  );
}
