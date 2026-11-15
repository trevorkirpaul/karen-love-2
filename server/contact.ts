import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { handleContactGet, handleContactPost, type ContactHandlerDeps } from "@/lib/contact/handler";

const MAX_BODY_BYTES = 64 * 1024;

class PayloadTooLargeError extends Error {
  constructor() {
    super("Request payload exceeds 64 KB limit.");
    this.name = "PayloadTooLargeError";
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}

async function sendNodeResponse(res: ServerResponse, webResponse: Response): Promise<void> {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await webResponse.text();
  res.end(body);
}

export async function routeContactRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ContactHandlerDeps = {},
): Promise<void> {
  const method = (req.method ?? "GET").toUpperCase();
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (method === "GET" && url.pathname === "/api/health") {
    await sendNodeResponse(
      res,
      new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    );
    return;
  }

  if (
    method === "GET" &&
    (url.pathname === "/api/contact" || url.pathname === "/api/contact/challenge")
  ) {
    const request = new Request(url.href, {
      method: "GET",
      headers: toHeaders(req),
    });
    const response = await handleContactGet(request);
    await sendNodeResponse(res, response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/contact") {
    try {
      const bodyText = await readBody(req);
      const request = new Request(url.href, {
        method: "POST",
        headers: toHeaders(req),
        body: bodyText,
      });
      const response = await handleContactPost(request, req.socket?.remoteAddress, deps);
      await sendNodeResponse(res, response);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        await sendNodeResponse(
          res,
          new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          }),
        );
        return;
      }
      console.error("[contact-server] Unexpected error:", error);
      await sendNodeResponse(
        res,
        new Response(JSON.stringify({ ok: false, error: "Internal server error." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return;
  }

  await sendNodeResponse(
    res,
    new Response(JSON.stringify({ ok: false, error: "Not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.PORT ?? "4321", 10);

  const server = createServer((req, res) => {
    void routeContactRequest(req, res);
  });

  server.listen(port, host, () => {
    console.info(`[contact-server] Listening on http://${host}:${port}`);
  });
}
