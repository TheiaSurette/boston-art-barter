export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return `"${file.name}" is not a valid image type. Allowed: JPEG, PNG, WebP, GIF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 4 MB limit.`;
  }
  return null;
}
