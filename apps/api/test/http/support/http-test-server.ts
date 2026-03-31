import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import type { ApiHttpServer } from "../../../src/http/api-http-server.ts";

const LOOPBACK_HOST = "127.0.0.1";
const MAX_PORT_ATTEMPTS = 32;

// Node fetch follows the Fetch spec blocked-port list and rejects these outright.
const FETCH_BLOCKED_PORTS = new Set<number>([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

async function reserveFetchSafePort(host: string): Promise<number> {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
    const probe = createServer();
    probe.listen(0, host);
    await once(probe, "listening");

    const address = probe.address();
    assert.ok(address && typeof address !== "string", "Expected a tcp server address.");
    const port = (address as AddressInfo).port;

    probe.close();
    await once(probe, "close");

    if (!FETCH_BLOCKED_PORTS.has(port)) {
      return port;
    }
  }

  throw new Error(
    `Could not reserve a fetch-safe loopback port after ${MAX_PORT_ATTEMPTS} attempts.`,
  );
}

export async function startHttpTestServer(server: ApiHttpServer): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
}> {
  const port = await reserveFetchSafePort(LOOPBACK_HOST);
  server.listen(port, LOOPBACK_HOST);
  await once(server, "listening");

  return {
    server,
    baseUrl: `http://${LOOPBACK_HOST}:${port}`,
  };
}

export async function stopHttpTestServer(server: ApiHttpServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  server.close();
  await once(server, "close");
}
