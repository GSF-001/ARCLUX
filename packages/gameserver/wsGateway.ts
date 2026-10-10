// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// wsGateway.ts — P2-7 (08 §4 Sprint 3): WebSocket transport sungguhan.
//
// Sebelumnya "WebSocketTransport" hanya helper/fake (createWsInterestServer).
// Gateway ini implement RFC6455 server-side sungguhan (handshake Sec-WebSocket
// + frame text/close/ping) tanpa dependency — cukup untuk JSON snapshot/
// delta stream. Binary frame = follow-up (kontrak UE pakai HTTP /snapshot
// + /intent dulu; WS untuk delta real-time).
//
// Protokol:
//   connect  ws://host/ws?token=<login-token>   → kirim {type:"snapshot", ...}
//   server   tiap tick                          → {type:"delta", tick, entities, removed, dilation}
//   client   {"type":"hello","lastTick":N}      → snapshot ulang
//   client   {"type":"ping"}                    → {"type":"pong"}

import { createHash } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { WorldRegion } from "./world";
import type { SimulationEngine } from "./simulation";
import { sanitizeSnapshot } from "./visibility";
import { SNAPSHOT_SCHEMA_VERSION, type RegionSnapshot } from "./types";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** Interest radius default (meter) — sama dengan helper lama. */
export const WS_INTEREST_RADIUS_M = 5_000;

interface WsClient {
  socket: Duplex;
  buffer: Buffer;
  playerId?: string;
  lastTick: number;
  closed: boolean;
}

function acceptKey(key: string): string {
  return createHash("sha1").update(key + WS_GUID).digest("base64");
}

/** Encode server→client text frame (unmasked, fin=1). */
function encodeFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Decode frame client→server (masked wajib per RFC). Return null bila parsial. */
function decodeFrames(client: WsClient): Array<{ opcode: number; payload: Buffer }> {
  const out: Array<{ opcode: number; payload: Buffer }> = [];
  let buf = client.buffer;
  while (buf.length >= 2) {
    const byte0 = buf[0];
    const byte1 = buf[1];
    const opcode = byte0 & 0x0f;
    const masked = (byte1 & 0x80) !== 0;
    let len = byte1 & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (buf.length < 4) break;
      len = buf.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (buf.length < 10) break;
      len = Number(buf.readBigUInt64BE(2));
      offset = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length < offset + maskLen + len) break;
    let payload = buf.subarray(offset + maskLen, offset + maskLen + len);
    if (masked) {
      const mask = buf.subarray(offset, offset + 4);
      const un = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) un[i] = payload[i] ^ mask[i % 4];
      payload = un;
    }
    out.push({ opcode, payload });
    buf = buf.subarray(offset + maskLen + len);
  }
  client.buffer = buf;
  return out;
}

export interface WsGatewayHandle {
  /** Kirim delta tick terbaru ke semua klien (dipanggil server tiap tick). */
  broadcast(): void;
  clientCount(): number;
  close(): void;
}

export interface WsGatewayOptions {
  region: WorldRegion;
  engine: SimulationEngine;
  /** Verifikasi login token → playerId (undefined = tolak). */
  verifyToken?: (token: string) => string | undefined;
  /** Interest radius (meter). */
  radiusM?: number;
}

/**
 * Attach WS upgrade handler ke HTTP server yang sudah ada (path /ws).
 * Delta di-filter per-klien: interest radius dari posisi vessel milik viewer
 * (bila ada) — P2-1.
 */
export function attachWebSocketGateway(httpServer: Server, opts: WsGatewayOptions): WsGatewayHandle {
  const { region, engine } = opts;
  const radius = opts.radiusM ?? WS_INTEREST_RADIUS_M;
  const clients = new Set<WsClient>();

  const send = (c: WsClient, obj: unknown): void => {
    if (c.closed) return;
    try {
      c.socket.write(encodeFrame(JSON.stringify(obj)));
    } catch {
      c.closed = true;
    }
  };

  const viewerCenter = (playerId?: string): { x: number; y: number; z: number } | undefined => {
    if (!playerId) return undefined;
    for (const v of region.vessels()) {
      if (v.owner === playerId) return v.position;
    }
    return undefined;
  };

  const sendSnapshot = (c: WsClient): void => {
    send(c, { type: "snapshot", snapshot: sanitizeSnapshot(region.snapshot(), c.playerId) });
  };

  const handleMessage = (c: WsClient, raw: string): void => {
    let msg: { type?: string; lastTick?: number };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "hello") {
      if (typeof msg.lastTick === "number") c.lastTick = msg.lastTick;
      sendSnapshot(c);
    } else if (msg.type === "ping") {
      send(c, { type: "pong", tick: region.tick });
    }
  };

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const u = new URL(req.url ?? "/", "http://localhost");
    if (u.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string" || !key) {
      socket.destroy();
      return;
    }
    // Auth: token opsional — tanpa verifier = anonymous viewer.
    let playerId: string | undefined;
    const token = u.searchParams.get("token");
    if (token && opts.verifyToken) playerId = opts.verifyToken(token);
    if (!token && opts.verifyToken) {
      // Verifier aktif tapi tanpa token → tolak.
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`
    );
    const client: WsClient = { socket, buffer: Buffer.alloc(0), playerId, lastTick: region.tick, closed: false };
    clients.add(client);
    sendSnapshot(client);

    socket.on("data", (chunk: Buffer) => {
      client.buffer = client.buffer.length ? Buffer.concat([client.buffer, chunk]) : chunk;
      for (const frame of decodeFrames(client)) {
          if (frame.opcode === 0x8) {
          client.closed = true;
          socket.destroy();
        } else if (frame.opcode === 0x9) {
          try {
            // pong (0xA) — echo payload ping.
            const pong = Buffer.concat([Buffer.from([0x8a, frame.payload.length]), frame.payload]);
            socket.write(pong);
          } catch {
            /* ignore */
          }
        } else if (frame.opcode === 0x1) {
          handleMessage(client, frame.payload.toString("utf8"));
        }
      }
    });
    const drop = (): void => {
      client.closed = true;
      clients.delete(client);
    };
    socket.on("close", drop);
    socket.on("error", drop);
    void head;
  };

  httpServer.on("upgrade", onUpgrade);

  return {
    broadcast(): void {
      const tick = region.tick;
      const removed = region.removedSince(Math.max(0, tick - 2)); // selalu kirim removals terbaru
      for (const c of clients) {
        if (c.closed) {
          clients.delete(c);
          continue;
        }
        const center = viewerCenter(c.playerId);
        let changed = region.changedSince(c.lastTick);
        if (center) {
          changed = changed.filter((e) => {
            const dx = e.position.x - center.x;
            const dy = e.position.y - center.y;
            const dz = e.position.z - center.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius;
          });
        }
        // Privasi per-viewer (P2-4) — pakai sanitize yang sama dengan HTTP.
        const deltaSnap: RegionSnapshot = {
          regionId: region.regionId,
          name: region.name,
          tick,
          createdAt: region.createdAt,
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          entities: changed,
        };
        const viewerEntities = sanitizeSnapshot(deltaSnap, c.playerId).entities;
        send(c, {
          type: "delta",
          tick,
          entities: viewerEntities,
          removed,
          dilation: region.dilation,
        });
        c.lastTick = tick;
      }
    },
    clientCount(): number {
      return clients.size;
    },
    close(): void {
      for (const c of clients) {
        c.closed = true;
        try {
          c.socket.destroy();
        } catch {
          /* ignore */
        }
      }
      clients.clear();
      httpServer.removeListener("upgrade", onUpgrade);
    },
  };
}
