// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// handoffToken.ts — token handoff lintas shard CRYPTOGRAPHIC (P0-6 / Sprint 4).
//
// Sebelumnya relay memakai `sanitizeToken` heuristik (cek substring "import ",
// "function ", dll) — lemah: string tanpa substring terlarang lolos. Sprint 4
// menggantinya dengan Ed25519:
//
//   - Setiap shard punya keypair (node:crypto ed25519).
//   - Token = base64url(body).base64url(signature) — body berisi HANYA id
//     (vesselId/playerId/shard/region/seq/iat/exp), TIDAK PERNAH source code
//     (struktur kunci di-witelist ketat: anti-clone D ship=code tetap berlaku
//     secara struktural, bukan heuristik).
//   - Target/relay verifikasi dengan PUBLIC KEY saja (asimetris — verifier
//     tidak bisa menandatangani).
//
// Cross-process: shard asal sign dengan private key-nya, server tujuan
// (atau relay) verifikasi dengan public key yang dikonfigurasi.

import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

/** Payload token — HANYA id & meta routing. Dilarang field bebas (anti-clone). */
export interface HandoffTokenPayload {
  vesselId: string;
  playerId: string;
  fromShardId: string;
  toShardId: string;
  toRegionId: string;
  seq: number;
  /** issued-at (unix ms). */
  iat: number;
  /** expiry (unix ms). */
  exp: number;
}

/** TTL handoff token — singkat (handoff adalah transisi detik, bukan sesi). */
export const HANDOFF_TOKEN_TTL_MS = 60_000;

/** Clock skew yang ditoleransi saat verifikasi (ms). */
const SKEW_MS = 5_000;

const ALLOWED_KEYS = ["vesselId", "playerId", "fromShardId", "toShardId", "toRegionId", "seq", "iat", "exp"] as const;

export interface HandoffKeyPair {
  /** SPKI DER base64 — dibagikan ke verifier (relay/server tujuan). */
  publicKey: string;
  /** PKCS8 DER base64 — TIDAK PERNAH keluar dari pemilik shard. */
  privateKey: string;
}

export function generateHandoffKeyPair(): HandoffKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function toPrivateKey(keyB64: string) {
  return createPrivateKey({ key: Buffer.from(keyB64, "base64"), format: "der", type: "pkcs8" });
}

function toPublicKey(keyB64: string) {
  return createPublicKey({ key: Buffer.from(keyB64, "base64"), format: "der", type: "spki" });
}

/** Bangun payload lengkap (iat/exp dari now) — helper pembuat token. */
export function buildHandoffPayload(
  base: Omit<HandoffTokenPayload, "iat" | "exp">,
  now: number = Date.now(),
  ttlMs: number = HANDOFF_TOKEN_TTL_MS,
): HandoffTokenPayload {
  return { ...base, iat: now, exp: now + ttlMs };
}

/** Sign payload → token string. Body di-serialize dengan urutan kunci tetap. */
export function signHandoffToken(payload: HandoffTokenPayload, privateKeyB64: string): string {
  // urutan kunci tetap (ALLOWED_KEYS) → serialisasi deterministik.
  const body = JSON.stringify({
    vesselId: payload.vesselId,
    playerId: payload.playerId,
    fromShardId: payload.fromShardId,
    toShardId: payload.toShardId,
    toRegionId: payload.toRegionId,
    seq: payload.seq,
    iat: payload.iat,
    exp: payload.exp,
  });
  const bodyBuf = Buffer.from(body, "utf8");
  const sig = sign(null, bodyBuf, toPrivateKey(privateKeyB64));
  return `${b64url(bodyBuf)}.${b64url(sig)}`;
}

export type HandoffTokenVerdict =
  | { ok: true; payload: HandoffTokenPayload }
  | { ok: false; reason: string };

/** Verifikasi token dengan public key. Structural whitelist = anti-clone. */
export function verifyHandoffToken(
  token: string,
  publicKeyB64: string,
  now: number = Date.now(),
): HandoffTokenVerdict {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed token" };
  const bodyB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  const bodyBuf = fromB64url(bodyB64);
  const sig = fromB64url(sigB64);

  let valid = false;
  try {
    valid = verify(null, bodyBuf, toPublicKey(publicKeyB64), sig);
  } catch {
    return { ok: false, reason: "signature check threw (bad key?)" };
  }
  if (!valid) return { ok: false, reason: "bad signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyBuf.toString("utf8"));
  } catch {
    return { ok: false, reason: "body not JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "body not object" };
  }
  const rec = parsed as Record<string, unknown>;

  // Structural whitelist — token TIDAK BOLEH membawa field lain (anti-clone:
  // representasi & id saja, tidak pernah source code / blob bebas).
  const keys = Object.keys(rec);
  if (keys.length !== ALLOWED_KEYS.length || !ALLOWED_KEYS.every((k) => k in rec)) {
    return { ok: false, reason: "payload fields not exactly the allowed set (anti-clone)" };
  }
  for (const k of ALLOWED_KEYS) {
    const v = rec[k];
    if (k === "seq") {
      if (typeof v !== "number" || !Number.isInteger(v)) return { ok: false, reason: "seq not integer" };
    } else if (k === "iat" || k === "exp") {
      if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, reason: `${k} not number` };
    } else {
      if (typeof v !== "string" || v.length === 0) return { ok: false, reason: `${k} not non-empty string` };
    }
  }

  const payload = rec as unknown as HandoffTokenPayload;
  if (payload.exp < now - SKEW_MS) return { ok: false, reason: "token expired" };
  if (payload.iat > now + SKEW_MS) return { ok: false, reason: "token iat in the future" };
  return { ok: true, payload };
}
