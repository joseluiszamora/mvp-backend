export function matchesFileSignature(mimeType: string, bytes: Uint8Array): boolean {
  const start = (hex: string) => Buffer.from(bytes.subarray(0, hex.length / 2)).toString("hex") === hex;
  switch (mimeType) {
    case "application/pdf": return start("255044462d");
    case "image/png": return start("89504e470d0a1a0a");
    case "image/jpeg": return start("ffd8ff");
    case "image/webp": return start("52494646") && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP";
    case "text/plain":
      if (bytes.includes(0)) return false;
      try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; } catch { return false; }
    default: return false;
  }
}
