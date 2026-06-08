import { createServer, type Server } from "node:http";
import { text } from "node:stream/consumers";

export interface MockServer {
  url: string;
  /** Recorded requests: { path, body } */
  requests: Array<{ path: string; body: any }>;
  close: () => Promise<void>;
}

export type Routes = Record<string, (body: any) => { status?: number; json: unknown }>;

/** Start a mock server. `routes` maps pathname → handler returning a JSON response. */
export async function startMockServer(routes: Routes): Promise<MockServer> {
  const requests: Array<{ path: string; body: any }> = [];
  const server: Server = createServer(async (req, res) => {
    const path = (req.url ?? "").split("?")[0];
    let body: any = {};
    try {
      const raw = await text(req);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
    requests.push({ path, body });
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
