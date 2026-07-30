import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

/**
 * Deletes the temp directory created by cloneRepository.ts.
 * Guards against accidentally rm -rf'ing something outside the OS temp dir —
 * cloneRepository.ts always creates paths under os.tmpdir(), so anything else is suspicious.
 */
export async function cleanupRepository(localPath: string): Promise<void> {
  const resolved = resolve(localPath);
  const systemTmp = resolve(tmpdir());

  if (!resolved.startsWith(systemTmp)) {
    throw new Error(
      `Refusing to delete "${resolved}": not inside system temp dir (${systemTmp}). ` +
        `This looks like a bug, not a real cleanup target.`
    );
  }

  await rm(resolved, { recursive: true, force: true });
}
