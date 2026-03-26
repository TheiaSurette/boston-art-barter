/**
 * Normalizes an Instagram handle from various input formats:
 * - "@handle" → "handle"
 * - "https://instagram.com/handle" → "handle"
 * - "handle" → "handle"
 */
export function normalizeInstagram(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.hostname.replace("www.", "") === "instagram.com") {
      return url.pathname.replace(/^\/+|\/+$/g, "");
    }
  } catch {
    // Not a URL, treat as handle
  }
  return trimmed.replace(/^@+/, "");
}

/**
 * Sanitizes a name for use in filenames (replaces non-alphanumeric characters with underscores).
 */
export function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}
