import assert from "node:assert/strict";
import test from "node:test";
import { isValidAvatarDataUrl, matchesFileSignature, maxAvatarBytes } from "../src/lib/file-signature";

test("rechaza contenido que contradice el tipo declarado", () => {
  const fakePdf = new TextEncoder().encode("texto que no es PDF");
  assert.equal(matchesFileSignature("application/pdf", fakePdf), false);
  assert.equal(matchesFileSignature("image/png", fakePdf), false);
  assert.equal(matchesFileSignature("application/octet-stream", fakePdf), false);
});

test("acepta una firma PDF y texto UTF-8 sin bytes nulos", () => {
  assert.equal(matchesFileSignature("application/pdf", new TextEncoder().encode("%PDF-1.7")), true);
  assert.equal(matchesFileSignature("text/plain", new TextEncoder().encode("Información válida")), true);
  assert.equal(matchesFileSignature("text/plain", new Uint8Array([65, 0, 66])), false);
  assert.equal(matchesFileSignature("text/plain", new Uint8Array([0xff])), false);
});

test("valida firmas y límite de 2 MB para fotografías de avatar", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const webp = new Uint8Array(12);
  Buffer.from("RIFF").copy(webp);
  Buffer.from("WEBP").copy(webp, 8);
  const asDataUrl = (mime: string, bytes: Uint8Array) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

  assert.equal(isValidAvatarDataUrl(asDataUrl("image/png", png)), true);
  assert.equal(isValidAvatarDataUrl(asDataUrl("image/jpeg", jpeg)), true);
  assert.equal(isValidAvatarDataUrl(asDataUrl("image/webp", webp)), true);
  assert.equal(isValidAvatarDataUrl(asDataUrl("image/png", jpeg)), false);

  const maximum = new Uint8Array(maxAvatarBytes);
  maximum.set(png);
  const oversized = new Uint8Array(maxAvatarBytes + 1);
  oversized.set(png);
  assert.equal(isValidAvatarDataUrl(asDataUrl("image/png", maximum)), true);
  assert.equal(isValidAvatarDataUrl(asDataUrl("image/png", oversized)), false);
});
