import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedOrigin } from "../src/lib/request-origin";

test("acepta el destino real cuando Next.js normaliza localhost", () => {
  const request = new Request("http://localhost:3100/api/panel", { headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" } });
  assert.equal(isAllowedOrigin(request), true);
  assert.equal(isAllowedOrigin(request, "https://panel.example.com"), false);
});

test("rechaza orígenes externos o ausentes y respeta el origen configurado", () => {
  assert.equal(isAllowedOrigin(new Request("https://panel.example.com/api/panel", { headers: { origin: "https://externo.example.com" } })), false);
  assert.equal(isAllowedOrigin(new Request("https://panel.example.com/api/panel")), false);
  const proxy = new Request("http://localhost:3100/api/panel", { headers: { host: "localhost:3100", origin: "https://panel.example.com" } });
  assert.equal(isAllowedOrigin(proxy, "https://panel.example.com"), true);
});
