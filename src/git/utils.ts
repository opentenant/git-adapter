import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

export interface GitTokens {
  githubToken?: string;
  gitlabComToken?: string;
  gitlabCustomToken?: string;
  codebergToken?: string;
  forgejoCustomToken?: string;
  giteaToken?: string;
  giteaCustomToken?: string;
}

interface PlatformAuth {
  tokenKey: keyof GitTokens;
  username: string;
}

const PLATFORM_AUTH: Record<string, PlatformAuth> = {
  github: { tokenKey: 'githubToken', username: 'x-access-token' },
  gitlab: { tokenKey: 'gitlabComToken', username: 'oauth2' },
  'gitlab.com': { tokenKey: 'gitlabComToken', username: 'oauth2' }, // legacy alias
  'gitlab.custom': { tokenKey: 'gitlabCustomToken', username: 'oauth2' },
  codeberg: { tokenKey: 'codebergToken', username: 'oauth2' },
  'forgejo.custom': { tokenKey: 'forgejoCustomToken', username: 'oauth2' },
  gitea: { tokenKey: 'giteaToken', username: 'oauth2' },
  'gitea.custom': { tokenKey: 'giteaCustomToken', username: 'oauth2' },
};

export const run = (
  args: string[],
  opts: { env: NodeJS.ProcessEnv; cwd: string; timeoutMs: number },
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf-8');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf-8');
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-64 * 1024);
    });

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(() => reject(new Error(`git ${args[0]} timed out`)));
    }, opts.timeoutMs);

    child.on('error', (err) => settle(() => reject(err)));
    child.on('exit', (code, signal) => {
      if (signal) {
        settle(() => reject(new Error(`git ${args[0]} killed by ${signal}`)));
      } else if (code !== 0) {
        settle(() =>
          reject(new Error(`git ${args[0]} exited ${code}: ${stderr.trim()}`)),
        );
      } else {
        settle(() => resolve({ stdout, stderr }));
      }
    });
  });

export const createGitEnv = (
  platform: string,
  tokens: GitTokens,
): NodeJS.ProcessEnv => {
  const auth = PLATFORM_AUTH[platform];
  if (!auth) {
    throw new Error(`git_unsupported_platform: ${platform}`);
  }

  const rawToken = tokens[auth.tokenKey];
  if (!rawToken) {
    throw new Error(
      `git_not_configured: Missing token for platform ${platform}`,
    );
  }

  const tokenB64 = Buffer.from(`${auth.username}:${rawToken}`).toString(
    'base64',
  );

  return {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: tmpdir(),
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${tokenB64}`,
  };
};
