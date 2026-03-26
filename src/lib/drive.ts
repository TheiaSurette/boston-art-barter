/**
 * Returns a public image URL for a Google Drive file ID.
 * If the input is already a full URL, it is returned as-is.
 */
export function driveImageUrl(idOrUrl: string, size = 800): string {
  if (idOrUrl.startsWith("http://") || idOrUrl.startsWith("https://")) {
    return idOrUrl;
  }
  return `https://lh3.googleusercontent.com/d/${idOrUrl}=w${size}`;
}

/** Pattern that matches a bare Google Drive file ID (no slashes, alphanumeric + hyphens/underscores). */
export const DRIVE_ID_PATTERN = /^[\w-]+$/;
