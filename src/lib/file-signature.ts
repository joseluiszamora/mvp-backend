export function matchesFileSignature(mimeType: string, bytes: Uint8Array): boolean {
  const start = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  switch (mimeType) {
    case "application/pdf": return start(0x25, 0x50, 0x44, 0x46, 0x2d);
    case "image/png": return start(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg": return start(0xff, 0xd8, 0xff);
    case "image/webp": return start(0x52, 0x49, 0x46, 0x46) && startAt(bytes, 8, 0x57, 0x45, 0x42, 0x50);
    case "text/plain":
      if (bytes.includes(0)) return false;
      try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; } catch { return false; }
    default: return false;
  }
}

function startAt(bytes: Uint8Array, offset: number, ...signature: number[]): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

export const maxAvatarBytes = 2 * 1024 * 1024;

export function isValidAvatarDataUrl(value: string): boolean {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(value);
  if (!match || !match[2] || match[2].length > 4 * Math.ceil(maxAvatarBytes / 3)) return false;
  try {
    const binary = atob(match[2]);
    if (binary.length < 1 || binary.length > maxAvatarBytes) return false;
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return matchesFileSignature(match[1], bytes);
  } catch {
    return false;
  }
}
