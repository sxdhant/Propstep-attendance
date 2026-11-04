import "server-only";

export const MAX_AVATAR_BYTES = 400_000;

/** Identifies an image by its first bytes, never by what the client claims it is. */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export const avatarUrl = (ownerId: string, version: number | string) => `/api/avatars/${encodeURIComponent(ownerId)}?v=${version}`;
