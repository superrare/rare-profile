import { createServer, type Server } from "node:http";
import { arrayBuffer } from "node:stream/consumers";

export interface MockRequest {
  path: string;
  url: string;
  body: any;
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export interface MockServer {
  url: string;
  requests: MockRequest[];
  close: () => Promise<void>;
}

export type Routes = Record<string, (body: any) => { status?: number; json: unknown }>;

/** Start a mock server. `routes` maps pathname → handler returning a JSON response. */
export async function startMockServer(routes: Routes): Promise<MockServer> {
  const requests: MockRequest[] = [];
  const server: Server = createServer(async (req, res) => {
    const url = req.url ?? "";
    const path = url.split("?")[0];
    const rawBody = Buffer.from(await arrayBuffer(req));
    let body: any = rawBody;
    if (req.headers["content-type"]?.includes("application/json")) {
      try {
        body = rawBody.length > 0 ? JSON.parse(rawBody.toString("utf8")) : {};
      } catch {
        body = {};
      }
    }
    requests.push({ path, url, body, rawBody, headers: { ...req.headers } });
    const handler = routes[path];
    if (!handler) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const out = handler(body);
    res.writeHead(out.status ?? 200, { "content-type": "application/json" });
    res.end(JSON.stringify(out.json));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
