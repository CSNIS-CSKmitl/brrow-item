import { error } from "@sveltejs/kit";
import { getPocketBaseUrl } from "$lib/server/pocketbase";
import { SESSION_COOKIE } from "$lib/server/session";

export const trailingSlash = "ignore";

export const fallback = async ({ request, fetch, url, cookies }) => {
  const pbUrl = getPocketBaseUrl();
  let subPath = url.pathname.replace(/^\/api\/db/, "") || "/";
  if (subPath === "/_") subPath = "/_/";

  const targetUrl = `${pbUrl.replace(/\/+$/, "")}${subPath}${url.search}`;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (
      ![
        "host",
        "accept-encoding",
        "content-length",
        "connection",
        "transfer-encoding",
      ].includes(key.toLowerCase())
    ) {
      headers.set(key, value);
    }
  }

  try {
    const isPost = request.method === "POST";
    const isAuthRequest =
      isPost &&
      /\/api\/collections\/users\/(auth-with-password|auth-refresh|auth-with-oauth2)(?:$|\?)/.test(
        subPath,
      );

    let body = request.body;
    if (isAuthRequest) {
      body = await request.clone().arrayBuffer();
    }

    let upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body ? body : undefined,
      redirect: "manual",
      // @ts-ignore
      duplex: body ? "half" : undefined,
    });

    if ([301, 302, 307, 308].includes(upstream.status)) {
      const loc = upstream.headers.get("location");
      if (loc === "/_/" || loc === "/_" || loc?.endsWith("/_/")) {
        upstream = await fetch(`${pbUrl.replace(/\/+$/, "")}/_/${url.search}`, {
          method: "GET",
          headers,
        });
      }
    }

    const responseHeaders = new Headers(upstream.headers);
    for (const key of [
      "content-encoding",
      "content-length",
      "connection",
      "transfer-encoding",
    ]) {
      responseHeaders.delete(key);
    }

    const location = responseHeaders.get("location");
    if (location) {
      const cleanPb = pbUrl.replace(/\/+$/, "");
      if (location.startsWith(cleanPb)) {
        responseHeaders.set("location", location.replace(cleanPb, "/api/db"));
      } else if (location.startsWith("/") && !location.startsWith("/api/db")) {
        responseHeaders.set("location", `/api/db${location}`);
      }
    }

    let responseBody;
    if (isAuthRequest && upstream.status >= 200 && upstream.status < 300) {
      const text = await upstream.text();
      try {
        const data = JSON.parse(text);
        if (data?.token) {
          cookies.set(SESSION_COOKIE, data.token, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: url.protocol === "https:",
            maxAge: 60 * 60 * 24 * 7,
          });
        }
      } catch {}
      responseBody = text;
    } else {
      const isHtml =
        responseHeaders.get("content-type")?.includes("text/html") ?? false;
      responseBody = isHtml ? await upstream.arrayBuffer() : upstream.body;
    }

    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[PB Proxy Error]:", err);
    throw error(502, "Bad Gateway");
  }
};
