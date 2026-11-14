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

  if (parsedUrl.protocol !== "https:" || isBlockedHostname(parsedUrl.hostname)) {
    return { valid: false, error: "Only public https:// dataset URLs are allowed." };
  }

  return { valid: true, url: parsedUrl };
}
