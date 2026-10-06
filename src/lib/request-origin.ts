export function isAllowedOrigin(request: Request, configuredOrigin?: string): boolean {
  const url = new URL(request.url);
  // Next.js puede normalizar request.url a localhost aunque el navegador use
  // 127.0.0.1; Host conserva el destino real de la petición.
  const allowed = configuredOrigin ?? new URL(`${url.protocol}//${request.headers.get("host") ?? url.host}`).origin;
  return request.headers.get("origin") === allowed;
}
