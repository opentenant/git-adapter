import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

export interface GitTokens {
  githubToken?: string;
  gitlabComToken?: string;
  gitlabCustomToken?: string;
}

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
  const isGitLab = platform.includes('gitlab');
  const isGitLabCom = platform === 'gitlab' || platform === 'gitlab.com';

  let rawToken: string | undefined;
  let username: string;

  if (isGitLab) {
    rawToken = isGitLabCom ? tokens.gitlabComToken : tokens.gitlabCustomToken;
    username = 'oauth2';
  } else {
    rawToken = tokens.githubToken;
    username = 'x-access-token';
  }

  if (!rawToken) {
    throw new Error(
      `git_not_configured: Missing token for platform ${platform}`,
    );
  }

  const tokenB64 = Buffer.from(`${username}:${rawToken}`).toString('base64');

  return {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: tmpdir(),
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${tokenB64}`,
  };
};
