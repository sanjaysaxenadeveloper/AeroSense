/**
 * Security & validation helpers for remote public dataset URLs (SSRF prevention).
 */

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower === "::" ||
    lower === "metadata.google.internal" ||
    lower.startsWith("127.") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.") ||
    lower.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(lower) ||
    /^fe[89ab][0-9a-f]:/i.test(lower) ||
    /^f[cd][0-9a-f]{2}:/i.test(lower) ||
    lower.includes("::ffff:") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
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

export function isValidIsoDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());
}

export function isAllowedDatasetMimeType(contentTypeHeader: string | null): boolean {
  if (!contentTypeHeader) return true; // Some raw file CDNs omit content-type
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
