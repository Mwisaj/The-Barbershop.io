import { isIP } from 'node:net';

export function createGateway({ backendOrigin, appOrigin, secret, fetchUpstream = fetch }) {
  const backend = new URL(backendOrigin);
  const site = new URL(appOrigin);
  if (backend.protocol !== 'https:' || backend.origin !== backendOrigin || site.protocol !== 'https:' || site.origin !== appOrigin || !secret || secret.length < 32) throw new Error('Configure HTTPS BACKEND_ORIGIN, APP_ORIGIN and a 32+ character PROXY_SECRET.');
  const jsonError = (status, error) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
  return async request => {
    try {
      const url = new URL(request.url);
      if (!/^\/api\/(health|gallery(?:\/image\/[\w-]+)?|auth\/(?:session|login|logout|password|forgot-password|reset-password)|storage|availability|bookings(?:\/(?:lookup|cancel))?)$/.test(url.pathname)) return jsonError(404, 'Not found.');
      if (!['GET', 'POST', 'PUT'].includes(request.method)) return jsonError(405, 'Method not allowed.');
      // Vercel supplies this header; never accept client-provided x-client-ip.
      const ip = request.headers.get('x-vercel-forwarded-for');
      if (!ip || !isIP(ip)) return jsonError(400, 'Missing platform client address.');
      const headers = new Headers({ 'x-proxy-secret': secret, 'x-client-ip': ip });
      for (const name of ['cookie', 'origin', 'sec-fetch-site', 'content-type']) {
        if (request.headers.has(name)) headers.set(name, request.headers.get(name));
      }
      let body;
      if (request.method !== 'GET') {
        if (request.headers.get('origin') !== appOrigin || request.headers.get('sec-fetch-site') === 'cross-site') return jsonError(403, 'Request origin denied.');
        if (!request.headers.get('content-type')?.startsWith('application/json')) return jsonError(415, 'JSON required.');
        const limit = url.pathname === '/api/gallery' ? 1500000 : 65536;
        const chunks = [];
        let length = 0;
        const reader = request.body?.getReader();
        if (reader) {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > limit) { await reader.cancel(); return jsonError(413, 'Request too large.'); }
            chunks.push(value);
          }
        }
        body = Buffer.concat(chunks);
      }
      const target = new URL(url.pathname + url.search, backendOrigin);
      if (url.pathname === '/api/gallery') target.searchParams.set('metadata', '1');
      const upstream = await fetchUpstream(target, { method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(25000) });
      if (upstream.status >= 300 && upstream.status < 400) return jsonError(502, 'Unexpected backend redirect.');
      const responseHeaders = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      for (const name of ['content-type', 'retry-after']) if (upstream.headers.has(name)) responseHeaders.set(name, upstream.headers.get(name));
      for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append('set-cookie', cookie);
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch { return jsonError(502, 'The booking server is unavailable. Please try again shortly.'); }
  };
}
