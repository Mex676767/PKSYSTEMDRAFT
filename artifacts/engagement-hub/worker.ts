interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DO_API_ORIGIN?: string;
}

const isApiRequest = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
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
