// MCP stdio smoke test — JSON-RPC over stdin/stdout of `arclux mcp`.
// Verifies the exact runtime path where #616/#617/#618 were found:
// real argument passing, schema validation, and guard verdicts as the
// client would see them.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const BIN = "apps/cli/dist/arclux.mjs";
const CWD = process.cwd();

const child = spawn(process.execPath, [BIN, "mcp"], {
  cwd: CWD,
  stdio: ["pipe", "pipe", "pipe"],
});

const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
let nextId = 1;
const pending = new Map();

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    process.stderr.write("NON-JSON on stdout: " + line.slice(0, 200) + "\n");
    return;
  }
  if (msg.id != null && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function call(method, params = {}, id = nextId++) {
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("timeout: " + method));
      }
    }, 60000);
  });
}

async function toolCall(name, args) {
  const res = await call("tools/call", { name, arguments: args });
  if (res.error) return { error: res.error };
  const text = (res.result?.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  try {
    return { parsed: JSON.parse(text) };
  } catch {
    return { raw: text };
  }
}

// stderr passthrough (annotated)
child.stderr.on("data", (d) => process.stderr.write("[srv] " + d));

async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "arclux-smoke", version: "1.0" },
  });
  console.log("INIT ok, server:", init.result?.serverInfo?.name, "tools:", init.result?.serverInfo ? "(proto ok)" : "?");
  await call("notifications/initialized", {}, nextId++);

  // #616: branches with a localPath that HAS an origin (DEV.to)
  const b1 = await toolCall("branches", { localPath: "D:/Project/DEV.to" });
  console.log("#616 localPath (DEV.to):", JSON.stringify(b1).slice(0, 300));

  // #616: branches with NO arguments at all (cwd is 456789 repo root, which has origin)
  const b2 = await toolCall("branches", {});
  console.log("#616 no-args (cwd fallback):", JSON.stringify(b2).slice(0, 300));

  // #616: branches with a localPath that has NO origin remote (repo exists)
  const b3 = await toolCall("branches", { localPath: "C:/Users/misha/AppData/Local/Temp/arclux-no-origin" });
  console.log("#616 no-origin localPath:", JSON.stringify(b3).slice(0, 300));

  // #616: branches with a repoUrl that DOESN'T resolve (should be a clean error, not a crash)
  const b4 = await toolCall("branches", { repoUrl: "Z:/definitely-not-a-repo" });
  console.log("#616 bad repoUrl:", JSON.stringify(b4).slice(0, 300));

  // #617: search on an empty-index repo returns a notice, not a silent []
  const s1 = await toolCall("search", { localPath: "C:/Users/misha/AppData/Local/Temp/arclux-618", query: "foo" });
  console.log("#617 search empty-index repo:", JSON.stringify(s1).slice(0, 300));

  // #618: doctor on 0-module repo returns skipped/UNKNOWN guard, not all-orphan FAIL
  const d1 = await toolCall("doctor", { localPath: "C:/Users/misha/AppData/Local/Temp/arclux-618" });
  console.log("#618 doctor 0-module repo:", JSON.stringify(d1).slice(0, 300));

  child.kill();
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write("SMOKE FAIL: " + e.message + "\n");
  child.kill();
  process.exit(1);
});