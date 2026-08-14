// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pattern reference: Linux kernel include/linux/jbd2.h (ext4's journaling
// block device layer). Ported the real write-ahead-log transaction state
// machine (T_RUNNING -> T_LOCKED -> T_FLUSH -> T_COMMIT -> T_FINISHED), not
// a simplified version. Disk-block-specific sub-states (T_COMMIT_DFLUSH,
// T_COMMIT_JFLUSH, T_COMMIT_CALLBACK -- these split "commit" into physical
// disk-block flush phases) deliberately not ported -- those exist because
// jbd2 flushes actual disk blocks in stages; ARCLUX writes whole JSON files
// with fs.writeFileSync, there is no equivalent multi-block flush to stage.
//
// Core guarantee, same as jbd2: once a transaction reaches COMMIT, it is
// considered durable even if the real target file hasn't been written yet.
// A crash after COMMIT but before FINISHED is recoverable by REDOING the
// write from the payload already durably stored in the journal. A crash
// before COMMIT means the transaction never happened -- it's discarded,
// not applied, on the next recovery pass.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const TxnState = {
  RUNNING: "running",
  LOCKED: "locked",
  FLUSH: "flush",
  COMMIT: "commit",
  FINISHED: "finished",
} as const;

export type TxnStateValue = (typeof TxnState)[keyof typeof TxnState];

interface JournalRecord {
  txnId: string;
  state: TxnStateValue;
  at: number;
  /** target file this transaction writes to. Present on every record for a txn, kept simple rather than only on the FLUSH record. */
  targetPath: string;
  /** the data to write -- only present on the FLUSH record, which is what makes redo possible after a crash. */
  payload?: string;
}

export interface RecoveryResult {
  redone: string[];
  discarded: string[];
}

function arcluxRoot(): string {
  return process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux");
}

function journalPath(): string {
  return path.join(arcluxRoot(), "journal.log");
}

function ensureRoot(): void {
  fs.mkdirSync(arcluxRoot(), { recursive: true });
}

let txnCounter = 0;

function newTxnId(): string {
  txnCounter += 1;
  return `txn-${Date.now()}-${txnCounter}`;
}

/** Appends one journal record as a single JSON line. Each line is self-contained, so a crash mid-append corrupts at most the last (incomplete) line, never earlier committed records -- same reasoning as jbd2 appending fixed-size journal blocks. */
function appendRecord(record: JournalRecord): void {
  ensureRoot();
  fs.appendFileSync(journalPath(), JSON.stringify(record) + "\n", "utf8");
}

/** Reads all well-formed journal lines, silently skipping a trailing corrupt/partial line (the one that was being written when a crash happened). */
function readJournal(): JournalRecord[] {
  let raw: string;
  try {
    raw = fs.readFileSync(journalPath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const records: JournalRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // Partial line from a crash mid-append -- this is expected, not an error.
      // It's necessarily the last line (appendFileSync is append-only), so
      // stopping here is safe: no later committed record could exist after it.
      break;
    }
  }
  return records;
}

/**
 * Writes `data` to `targetPath` through the full RUNNING -> LOCKED -> FLUSH
 * -> COMMIT -> FINISHED transaction, instead of a plain fs.writeFileSync.
 * This is the function SnapshotManager.writeProcessRecord (and any future
 * caller needing crash-safe writes) should call.
 */
export function writeTransactional(targetPath: string, data: string): void {
  const txnId = newTxnId();

  appendRecord({ txnId, state: TxnState.RUNNING, at: Date.now(), targetPath });
  appendRecord({ txnId, state: TxnState.LOCKED, at: Date.now(), targetPath });
  // Payload durably logged BEFORE the real write -- this is what makes
  // REDO possible if the process dies between here and the real write below.
  appendRecord({ txnId, state: TxnState.FLUSH, at: Date.now(), targetPath, payload: data });
  // Point of no return: once this line is on disk, the transaction WILL be
  // applied (either now, or via redo on next recovery pass).
  appendRecord({ txnId, state: TxnState.COMMIT, at: Date.now(), targetPath });

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, data, "utf8");

  appendRecord({ txnId, state: TxnState.FINISHED, at: Date.now(), targetPath });
}

/**
 * Replays the journal: for each transaction, look at its LATEST recorded
 * state.
 *   - FINISHED: already fully applied. Nothing to do.
 *   - COMMIT: committed but the real write never completed (crash between
 *     COMMIT and FINISHED). REDO -- reapply the payload from its FLUSH
 *     record, matching jbd2's redo-on-recovery semantics.
 *   - RUNNING / LOCKED / FLUSH (never reached COMMIT): the transaction was
 *     never guaranteed. DISCARD -- do not touch targetPath, it's exactly
 *     as valid (or invalid) as it was before this transaction started.
 * After processing, the journal is truncated -- every transaction it knew
 * about has now been resolved one way or the other.
 */
export function recoverFromJournal(): RecoveryResult {
  const records = readJournal();
  const byTxn = new Map<string, JournalRecord[]>();

  for (const record of records) {
    const list = byTxn.get(record.txnId) ?? [];
    list.push(record);
    byTxn.set(record.txnId, list);
  }

  const redone: string[] = [];
  const discarded: string[] = [];

  for (const [txnId, txnRecords] of byTxn) {
    const latest = txnRecords[txnRecords.length - 1];

    if (latest.state === TxnState.FINISHED) {
      continue;
    }

    if (latest.state === TxnState.COMMIT) {
      const flushRecord = txnRecords.find((r) => r.state === TxnState.FLUSH);
      if (flushRecord && flushRecord.payload !== undefined) {
        fs.mkdirSync(path.dirname(flushRecord.targetPath), { recursive: true });
        fs.writeFileSync(flushRecord.targetPath, flushRecord.payload, "utf8");
        redone.push(flushRecord.targetPath);
      }
      continue;
    }

    // RUNNING or LOCKED or FLUSH-without-reaching-COMMIT: never guaranteed.
    discarded.push(latest.targetPath);
  }

  // Every known transaction is now resolved -- safe to start the journal fresh.
  ensureRoot();
  fs.writeFileSync(journalPath(), "", "utf8");

  return { redone, discarded };
}
