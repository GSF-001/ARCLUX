// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// economy.ts — otoritas OC (Orbital Credit) server-side (P1-6, 06 §1).
//
// Semua transaksi terjadi DI SINI, bukan di klien: klien hanya meminta;
// wallet + ledger adalah milik server. Prinsip:
//   - 1 OC = 1 unit, INTEGER tanpa pecahan (06 §1.1).
//   - Sumber credit di-whitelist (top-up, penjualan, bounty, mission) —
//     tidak ada jalur "klien klaim balance".
//   - P2P kena pajak 5% ke treasury dunia (06 §1.4).
//   - Tiap tx punya idempotency key — replay tidak menggandakan uang.
//   - Ledger append-only (log tidak pernah dihapus/dimodifikasi).

/** Pajak transaksi P2P — 5% masuk treasury dunia (06 §1.4, bukan NPC). */
export const TAX_RATE = 0.05;

/** Wallet khusus pajak/dana dunia. Bukan pemain. */
export const TREASURY_ID = "world:treasury";

/** Top-up minimum 10 OC (06 §1.3); maksimum tidak dibatasi. */
export const TOPUP_MIN = 10;

/** Katalog Company Store — harga TETAP server-set, bukan dynamic (06 §9.2). */
export interface StoreCatalogEntry {
  /** id unik permanen (06 §1.5). */
  itemId: string;
  name: string;
  price: number;
  category: "weapon" | "module" | "armor" | "supply";
}

export const ARCLUX_STORE: Record<string, StoreCatalogEntry> = {
  pistol: { itemId: "pistol", name: "Pistol", price: 500, category: "weapon" },
  rifle: { itemId: "rifle", name: "Rifle", price: 1500, category: "weapon" },
  shotgun: { itemId: "shotgun", name: "Shotgun", price: 2000, category: "weapon" },
  sniper: { itemId: "sniper", name: "Sniper", price: 5000, category: "weapon" },
  "grenade-x5": { itemId: "grenade-x5", name: "Grenade x5", price: 300, category: "weapon" },
  "engine-tier1": { itemId: "engine-tier1", name: "Engine tier-1", price: 3000, category: "module" },
  "shield-tier1": { itemId: "shield-tier1", name: "Shield tier-1", price: 2500, category: "module" },
  "weapon-tier1": { itemId: "weapon-tier1", name: "Weapon tier-1", price: 2000, category: "module" },
  "armor-basic": { itemId: "armor-basic", name: "Armor basic", price: 1000, category: "armor" },
  "armor-advanced": { itemId: "armor-advanced", name: "Armor advanced", price: 5000, category: "armor" },
  computer: { itemId: "computer", name: "Computer", price: 2000, category: "module" },
  "repair-kit": { itemId: "repair-kit", name: "Repair kit", price: 500, category: "supply" },
  medkit: { itemId: "medkit", name: "Medkit", price: 300, category: "supply" },
};

/** Item fisik dari store — fields persis 06 §1.5 (origin/durability/owner). */
export interface StoreItemInstance {
  /** Instance id unik permanen. */
  instanceId: string;
  catalogId: string;
  owner: string;
  origin: "arclux" | "player";
  durability: number;
  acquiredTick: number;
}

export type EconomyTxKind = "topup" | "credit" | "p2p" | "store";

/** Catatan ledger — append-only, tidak pernah dimodifikasi. */
export interface EconomyTx {
  id: string;
  kind: EconomyTxKind;
  from?: string;
  to?: string;
  itemId?: string;
  amount: number;
  /** Potongan pajak (khusus p2p). */
  tax: number;
  idempotencyKey?: string;
  tick: number;
}

export type EconomyResult =
  | { ok: true; txId?: string; tax: number; replayed: boolean }
  | { ok: false; reason: string; tax: number; replayed: boolean };

export interface EconomyState {
  wallets: Record<string, number>;
  items: StoreItemInstance[];
  tx: EconomyTx[];
  seq: number;
}

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

/**
 * Buat store ekonomi otoritatif. Semua metode synchronous & deterministic
 * (tidak ada Math.random / Date.now — tick masuk dari pemanggil).
 */
export function createEconomy(initial?: Partial<EconomyState>) {
  const wallets = new Map<string, number>(Object.entries(initial?.wallets ?? {}));
  let items: StoreItemInstance[] = initial?.items ? [...initial.items] : [];
  const tx: EconomyTx[] = initial?.tx ? [...initial.tx] : [];
  let seq = initial?.seq ?? tx.length;
  /** Idempotency: key → hasil — replayembalikan hasil lama, uang tidak dobel. */
  const idem = new Map<string, EconomyResult>();

  const balanceOf = (playerId: string): number => wallets.get(playerId) ?? 0;

  function record(kind: EconomyTxKind, fields: Omit<EconomyTx, "id" | "kind" | "tick"> & { tick?: number }, tick: number): EconomyTx {
    seq += 1;
    const rec: EconomyTx = { id: `tx:${seq}`, kind, amount: fields.amount, tax: fields.tax, tick: fields.tick ?? tick, ...(fields.from ? { from: fields.from } : {}), ...(fields.to ? { to: fields.to } : {}), ...(fields.itemId ? { itemId: fields.itemId } : {}), ...(fields.idempotencyKey ? { idempotencyKey: fields.idempotencyKey } : {}) };
    tx.push(rec); // append-only
    return rec;
  }

  function setBalance(id: string, n: number): void {
    if (n <= 0) wallets.delete(id); else wallets.set(id, n);
  }

  return {
    balanceOf,

    /** Top-up real money → OC (minimum TOPUP_MIN; server log semua tx). */
    topup(playerId: string, amount: number, tick = 0): EconomyResult {
      if (!isInt(amount) || amount < TOPUP_MIN) return { ok: false, reason: `topup minimum ${TOPUP_MIN} OC, integer`, tax: 0, replayed: false };
      setBalance(playerId, balanceOf(playerId) + amount);
      record("topup", { to: playerId, amount, tax: 0 }, tick);
      return { ok: true, tax: 0, replayed: false };
    },

    /** Credit server-side (bounty/mission) — sumber whitelist, bukan klaim klien. */
    credit(playerId: string, amount: number, tick = 0): EconomyResult {
      if (!isInt(amount) || amount < 1) return { ok: false, reason: "credit amount must be integer >= 1", tax: 0, replayed: false };
      setBalance(playerId, balanceOf(playerId) + amount);
      record("credit", { to: playerId, amount, tax: 0 }, tick);
      return { ok: true, tax: 0, replayed: false };
    },

    canAfford(playerId: string, amount: number): boolean {
      return isInt(amount) && amount >= 0 && balanceOf(playerId) >= amount;
    },

    /** Transfer P2P: pembeli bayar `amount`, penerima dapat amount−pajak. */
    transfer(args: { from: string; to: string; amount: number; idempotencyKey?: string; tick?: number }): EconomyResult {
      const { from, to, amount } = args;
      const tick = args.tick ?? 0;
      if (args.idempotencyKey) {
        const prior = idem.get(args.idempotencyKey);
        if (prior) return { ...prior, replayed: true };
      }
      const done = (r: EconomyResult): EconomyResult => {
        if (args.idempotencyKey && r.ok) idem.set(args.idempotencyKey, r);
        return r;
      };
      if (!isInt(amount) || amount < 1) return done({ ok: false, reason: "amount must be integer >= 1", tax: 0, replayed: false });
      if (from === to) return done({ ok: false, reason: "self transfer", tax: 0, replayed: false });
      if (balanceOf(from) < amount) return done({ ok: false, reason: "insufficient_funds", tax: 0, replayed: false });
      const tax = Math.floor(amount * TAX_RATE);
      const receive = amount - tax;
      setBalance(from, balanceOf(from) - amount);
      setBalance(to, balanceOf(to) + receive);
      if (tax > 0) setBalance(TREASURY_ID, balanceOf(TREASURY_ID) + tax);
      const rec = record("p2p", { from, to, amount, tax, idempotencyKey: args.idempotencyKey }, tick);
      return done({ ok: true, txId: rec.id, tax, replayed: false });
    },

    /** Beli dari Company Store — OC keluar (sink), item tercatat origin arclux. */
    buyFromStore(playerId: string, catalogId: string, tick = 0, idempotencyKey?: string): EconomyResult & { item?: StoreItemInstance } {
      if (idempotencyKey) {
        const prior = idem.get(idempotencyKey);
        if (prior) return { ...prior, replayed: true };
      }
      const entry = ARCLUX_STORE[catalogId];
      if (!entry) return { ok: false, reason: `unknown item: ${catalogId}`, tax: 0, replayed: false };
      if (balanceOf(playerId) < entry.price) return { ok: false, reason: `insufficient OC (price ${entry.price})`, tax: 0, replayed: false };
      setBalance(playerId, balanceOf(playerId) - entry.price);
      seq += 1;
      const instance: StoreItemInstance = { instanceId: `item:${seq}`, catalogId, owner: playerId, origin: "arclux", durability: 100, acquiredTick: tick };
      items = [...items, instance];
      const rec = record("store", { from: playerId, itemId: catalogId, amount: entry.price, tax: 0, idempotencyKey }, tick);
      const r: EconomyResult & { item?: StoreItemInstance } = { ok: true, txId: rec.id, tax: 0, replayed: false, item: instance };
      if (idempotencyKey) idem.set(idempotencyKey, r);
      return r;
    },

    itemsOf(playerId: string): StoreItemInstance[] {
      return items.filter((i) => i.owner === playerId);
    },

    /** Ledger append-only — jangan dimodifikasi di luar. */
    txLog(): readonly EconomyTx[] {
      return tx;
    },

    serialize(): EconomyState {
      return { wallets: Object.fromEntries(wallets), items: [...items], tx: [...tx], seq };
    },

    restore(state: EconomyState): void {
      wallets.clear();
      for (const [k, v] of Object.entries(state.wallets ?? {})) wallets.set(k, v);
      items = state.items ? [...state.items] : [];
      tx.length = 0;
      tx.push(...(state.tx ?? []));
      seq = state.seq ?? tx.length;
      idem.clear();
    },
  };
}

export type Economy = ReturnType<typeof createEconomy>;
