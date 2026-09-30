/**
 * Transparent proxy for TrueMoney gift vouchers.
 * Runs on Cloudflare's edge so datacenter / home IPs blocked by CF still work.
 * Does NOT redeem on its own - only forwards verify/redeem to gift.truemoney.com.
 */

const TM_ORIGIN = "https://gift.truemoney.com";
const ALLOWED = /^\/campaign\/vouchers\/[0-9A-Za-z]+\/(verify|redeem)\/?$/;

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  Origin: "https://gift.truemoney.com",
  Referer: "https://gift.truemoney.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export interface Env {
  RELAY_SECRET?: string;
}

function noStoreHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    Vary: "X-Relay-Secret",
    ...extra,
  };
}

function unauthorized(): Response {
  return Response.json(
    { status: { code: "UNAUTHORIZED", message: "relay auth failed" } },
    { status: 401, headers: noStoreHeaders() },
  );
}

function badRequest(message: string): Response {
  return Response.json(
    { status: { code: "BAD_REQUEST", message } },
    { status: 400, headers: noStoreHeaders() },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Server-to-server only - no browser CORS.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: noStoreHeaders() });
    }

    const secret = (env.RELAY_SECRET ?? "").trim();
    if (!secret) {
      return Response.json(
        {
          status: {
            code: "MISCONFIGURED",
            message: "RELAY_SECRET is required",
          },
        },
        { status: 503, headers: noStoreHeaders() },
      );
    }
    const got = (request.headers.get("X-Relay-Secret") ?? "").trim();
    if (!got || got !== secret) return unauthorized();

    const url = new URL(request.url);
    if (!ALLOWED.test(url.pathname)) {
      return badRequest("only /campaign/vouchers/:code/verify|redeem");
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return badRequest("method not allowed");
    }

    const upstream = new URL(url.pathname + url.search, TM_ORIGIN);
    const init: RequestInit = {
      method: request.method,
      headers: BROWSER_HEADERS,
      redirect: "manual",
      cf: { cacheTtl: 0, cacheEverything: false },
    } as RequestInit;
    if (request.method === "POST") {
      init.body = await request.text();
    }

    const upstreamRes = await fetch(upstream, init);
    const body = await upstreamRes.arrayBuffer();
    const contentType =
      upstreamRes.headers.get("content-type") ?? "application/json";

    return new Response(body, {
      status: upstreamRes.status,
      headers: noStoreHeaders({
        "Content-Type": contentType,
      }),
    });
  },
};
