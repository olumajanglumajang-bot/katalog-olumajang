import { handleApiRequest, type Env } from './cf-api';

export default {
  async fetch(request: Request, env: Env, _ctx: unknown): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle API routes (/api/*)
    if (url.pathname.startsWith('/api')) {
      return handleApiRequest(request, env);
    }

    // 2. Handle Static Assets (when deployed with Cloudflare Workers Assets)
    if (env.ASSETS) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }

        // SPA Navigation Fallback (e.g. /warung/xyz returns index.html)
        if (request.method === 'GET' && !url.pathname.includes('.')) {
          return await env.ASSETS.fetch(new Request(new URL('/', request.url), request));
        }

        return assetResponse;
      } catch (err) {
        console.error('[Cloudflare Worker Asset Error]', err);
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

export { handleApiRequest, type Env };
