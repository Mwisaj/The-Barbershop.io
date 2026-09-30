import { createGateway } from '../server/gateway.js';

export default {
  async fetch(request) {
    try {
      return await createGateway({ backendOrigin: process.env.BACKEND_ORIGIN, appOrigin: process.env.APP_ORIGIN, secret: process.env.PROXY_SECRET })(request);
    } catch {
      return Response.json({ error: 'The booking gateway is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  },
};
