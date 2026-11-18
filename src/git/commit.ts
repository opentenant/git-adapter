import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { run, createGitEnv, GitTokens } from './utils';

export interface CommitFileOptions {
  dest: string;
  branch: string;
  filePath: string; // relative to dest, e.g. 'ffmpeglab/render.sh'
  fileContent: string;
  commitMessage: string;
  platform: string;
  author: { name: string; email: string };
  tokens: GitTokens;
  timeoutMs?: number;
}

/**
 * Writes a file into the cloned repository, commits it on a new branch, 
 * and pushes the branch to origin.
 */
export const commitFileAndPush = async ({
  dest,
  branch,
  filePath,
  fileContent,
  commitMessage,
  author,
  platform,
  tokens,
  timeoutMs = 60_000,
}: CommitFileOptions): Promise<void> => {
  if (!fileContent.trim()) throw new Error('file_content_empty');

  const env = createGitEnv(platform, tokens);

  // 1. Write the file into the cloned repo.
  const target = join(dest, filePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, fileContent, 'utf-8');

  // 2. Branch from current HEAD (the base ref).
  await run(['checkout', '-b', branch], { env, cwd: dest, timeoutMs });

  // 3. Stage + commit with the bot's identity (does not touch .git/config).
  await run(['add', '-A'], { env, cwd: dest, timeoutMs });
  await run(
    [
      '-c',
      `user.name=${author.name}`,
      '-c',
      `user.email=${author.email}`,
      'commit',
      '-m',
      commitMessage,
    ],
    { env, cwd: dest, timeoutMs },
  );

  // 4. Push.
  await run(['push', 'origin', `HEAD:refs/heads/${branch}`], {
    env,
    cwd: dest,
    timeoutMs: 120_000,
  });
};