interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DO_API_ORIGIN?: string;
}

const isApiRequest = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");
const C9_OLD_HOST = "c9.mextest67.workers.dev";
const C9_CANONICAL_ORIGIN = "https://c9engagementhub.app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Keep the free C9 workers.dev URL working as an API origin for existing
    // sessions, while sending browser page and asset requests to the custom
    // domain. C6 shares this Worker code but uses a different hostname.
    if (url.hostname === C9_OLD_HOST && !isApiRequest(url.pathname)) {
      const destination = new URL(`${url.pathname}${url.search}`, C9_CANONICAL_ORIGIN);
      return Response.redirect(destination.toString(), 308);
    }

    if (isApiRequest(url.pathname)) {
      const origin = env.DO_API_ORIGIN?.trim().replace(/\/$/, "");
      if (!origin) return new Response("DigitalOcean API origin is not configured.", { status: 503 });
      let upstream: URL;
      try {
        upstream = new URL(`${url.pathname}${url.search}`, origin);
      } catch {
        return new Response("DigitalOcean API origin is invalid.", { status: 503 });
      }
      if (upstream.protocol !== "https:") return new Response("DigitalOcean API origin must use HTTPS.", { status: 503 });
      return fetch(new Request(upstream, request));
    }

    return env.ASSETS.fetch(request);
  },
};
