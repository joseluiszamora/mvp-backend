import assert from "node:assert/strict";
import test from "node:test";
import { matchesFileSignature } from "../src/lib/file-signature";

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
