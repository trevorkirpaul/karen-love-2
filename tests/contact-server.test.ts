import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { routeContactRequest } from "../server/contact";

function makeMockReq(method: string, url: string, body?: string): IncomingMessage {
  const stream = Readable.from(body ? [Buffer.from(body)] : []);
  return Object.assign(stream, {
    method,
    url,
    headers: {
      host: "127.0.0.1:4321",
      "content-type": "application/json",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }) as unknown as IncomingMessage;
}

function makeMockRes() {
  const headers = new Map<string, string | number | readonly string[]>();
  let responseBody = "";

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name.toLowerCase(), value);
    },
    end(chunk?: string | Buffer) {
      if (chunk) responseBody += chunk.toString();
    },
  } as unknown as ServerResponse;

  return {
    res,
    getBody: () => responseBody,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
  };
}

describe("routeContactRequest", () => {
  it("responds 200 on GET /api/health", async () => {
    const req = makeMockReq("GET", "/api/health");
    const mock = makeMockRes();

    await routeContactRequest(req, mock.res);

    expect(mock.res.statusCode).toBe(200);
    const json = JSON.parse(mock.getBody());
    expect(json.status).toBe("ok");
  });

  it("routes POST /api/contact to handleContactPost", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ channel: "resend" });
    const req = makeMockReq(
      "POST",
      "/api/contact",
      JSON.stringify({
        email: "patient@example.com",
        firstName: "Jane",
        lastName: "Doe",
        message: "Hello!",
      }),
    );
    const mock = makeMockRes();

    await routeContactRequest(req, mock.res, { sendMessage });

    expect(mock.res.statusCode).toBe(200);
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("returns 413 when payload exceeds 64 KB", async () => {
    const oversized = "x".repeat(70 * 1024);
    const req = makeMockReq("POST", "/api/contact", oversized);
    const mock = makeMockRes();

    await routeContactRequest(req, mock.res);

    expect(mock.res.statusCode).toBe(413);
  });

  it("returns 404 for unknown routes", async () => {
    const req = makeMockReq("GET", "/unknown");
    const mock = makeMockRes();

    await routeContactRequest(req, mock.res);

    expect(mock.res.statusCode).toBe(404);
  });
});
