import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, createGitEnv, GitTokens } from './utils';

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export interface CloneOptions {
  url: string;
  ref: string;
  dest: string;
  platform: string;
  tokens: GitTokens;
  timeoutMs?: number;
  maxBytes?: number;
}

const dirSize = async (dir: string): Promise<number> => {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else if (entry.isFile()) total += (await stat(full)).size;
  }
  return total;
};

export const cloneRepo = async ({
  url,
  ref,
  dest,
  platform,
  tokens,
  timeoutMs = 5 * 60 * 1000,
  maxBytes = 500 * 1024 * 1024,
}: CloneOptions): Promise<void> => {
  rmSync(dest, { recursive: true, force: true });

  const scratch = mkdtempSync(join(tmpdir(), 'ffgit-'));

  try {
    const env = createGitEnv(platform, tokens);
    
    // Override HOME for the clone process to isolate SSH/Git config
    env.HOME = scratch;

    const safe = (...args: string[]): string[] => [
      '-c',
      'protocol.ext.allow=never',
      '-c',
      'protocol.file.allow=never',
      ...args,
    ];

    if (SHA_PATTERN.test(ref)) {
      await mkdir(dest, { recursive: true });
      await run(safe('init', '--quiet', dest), { env, cwd: scratch, timeoutMs });
      await run(safe('remote', 'add', 'origin', url), { env, cwd: dest, timeoutMs });
      
      try {
        await run(safe('fetch', '--depth=1', 'origin', ref), { env, cwd: dest, timeoutMs });
        await run(safe('checkout', '--quiet', 'FETCH_HEAD'), { env, cwd: dest, timeoutMs });
      } catch {
        await run(safe('fetch', 'origin'), { env, cwd: dest, timeoutMs: timeoutMs * 3 });
        await run(safe('checkout', '--quiet', ref), { env, cwd: dest, timeoutMs });
      }
    } else {
      await run(
        safe(
          'clone',
          '--depth=1',
          '--single-branch',
          '--branch',
          ref,
          '--recurse-submodules=no',
          url,
          dest,
        ),
        { env, cwd: scratch, timeoutMs },
      );
    }

    const total = await dirSize(dest);
    if (total > maxBytes) {
      throw new Error(`repo_too_large: ${total} bytes (max ${maxBytes})`);
    }
  } catch (err) {
    rmSync(dest, { recursive: true, force: true });
    throw err;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};