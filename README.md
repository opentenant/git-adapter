# Unified Git API Client & CLI for Node.js

**A powerful, multi-platform Git SDK for Node.js and TypeScript.**
Manage repositories, invite collaborators, create merge requests, and execute native Git operations (`clone`, `commit`, `push`) across **GitHub**, **GitLab**, **Codeberg / Forgejo**, **Gitea**, and **custom self-hosted** instances using a single, unified interface.

[![npm version](https://img.shields.io/npm/v/git-adapter.svg)](https://www.npmjs.com/package/git-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)](https://nodejs.org)

## Features

- **Multi-Platform Support**: First-class support for GitHub, GitLab.com, Codeberg, Gitea.com, and self-hosted GitLab, Forgejo, and Gitea instances.
- **High-Level API**: Create repos, invite users, and open Merge Requests / Pull Requests programmatically.
- **Native Git Operations**: Safely clone, commit, and push changes with built-in timeout, size limits, and isolated environments.
- **Explicit Pagination**: Fetch specific pages of repositories with full metadata (`hasNextPage`, `nextPage`) to prevent memory bloat and timeouts.
- **Fully Typed**: Written in TypeScript with comprehensive interface definitions for requests and responses.
- **Zero Dependencies**: Built on the native Node.js `fetch` API and `child_process` (Node 18+).

---

## Installation

```bash
npm install git-adapter
# or
yarn add git-adapter
```

---

## Quick Start (API Adapters)

The library uses a factory pattern. You pass your tokens and platform configuration, and the library returns the correct adapter.

```typescript
import { getGitAdapter } from 'git-adapter';

// 1. Initialize the adapter
const git = getGitAdapter('github', {
  github: { agentUser: 'my-bot-user' }
});

// 2. Use the unified API (e.g., fetch the first page of repos)
const result = await git.listRepos('ghp_your_personal_access_token', {
  page: 1,
  perPage: 30
});

console.log(result.data);        // Array of repositories
console.log(result.hasNextPage); // true
console.log(result.nextPage);    // 2
```

The same code works on every platform. Only the factory call changes:

```typescript
// Codeberg
const codeberg = getGitAdapter('codeberg');

// Self-hosted Forgejo
const forgejo = getGitAdapter('forgejo.custom', {
  customForgejo: { apiUrl: 'https://git.mycompany.com/api/v1' },
});

// Gitea.com
const gitea = getGitAdapter('gitea');

// Self-hosted Gitea
const selfHostedGitea = getGitAdapter('gitea.custom', {
  customGitea: { apiUrl: 'https://git.mycompany.com/api/v1' },
});
```

### Platform Configuration

| Platform | Identifier | Options key | Notes |
| :--- | :--- | :--- | :--- |
| **GitHub** | `github` | `github` | Uses `api.github.com` |
| **GitLab** | `gitlab` | `gitlab` | Uses `gitlab.com/api/v4` |
| **Custom GitLab** | `gitlab.custom` | `customGitlab` | Requires `apiUrl` (e.g., `https://gitlab.mycompany.com/api/v4`) |
| **Codeberg** | `codeberg` | `codeberg` | Uses `codeberg.org/api/v1` (Forgejo) |
| **Custom Forgejo** | `forgejo.custom` | `customForgejo` | Requires `apiUrl` (e.g., `https://git.mycompany.com/api/v1`). Also works with Gitea. |
| **Gitea** | `gitea` | `gitea` | Uses `gitea.com/api/v1` |
| **Custom Gitea** | `gitea.custom` | `customGitea` | Requires `apiUrl` (e.g., `https://git.mycompany.com/api/v1`) |

Every options object accepts `apiUrl` and `agentUser`. For the `*.custom` platforms, `apiUrl` is required and the factory throws if it is missing.

> **Forgejo and Gitea** share the same `/api/v1` API, so both use one implementation under the hood. The separate identifiers exist for sensible default URLs and platform-specific error codes.

---

## API Reference

### Repositories

**List Repositories (Paginated)**
Fetches a single page of repositories the authenticated user has access to.

```typescript
const page1 = await git.listRepos('your_access_token', {
  page: 1,
  perPage: 100, // Max 100 for GitHub and GitLab
});

// page1.data = [{ full_name: 'org/repo-1', default_branch: 'main' }, ...]
```

> **Note:** Forgejo and Gitea instances cap page size server-side (commonly 50, configurable by the admin). If you request more than the cap, you get the cap. Always rely on `hasNextPage` rather than comparing against `perPage`.
> Ordering also differs: GitHub sorts by last update and GitLab by last activity, while Forgejo and Gitea return the server's default order.

**Fetching all repositories (Manual Loop)**
If you need to fetch everything, use the built-in pagination metadata to loop safely:

```typescript
let allRepos = [];
let page = 1;
let hasNext = true;

while (hasNext) {
  const result = await git.listRepos('your_access_token', { page, perPage: 100 });
  allRepos.push(...result.data);
  hasNext = result.hasNextPage;
  page = result.nextPage || 1;
}
```

**Create a Repository**
By default, the repository is private and initialized with a README.
```typescript
const newRepo = await git.createRepo(
  'your_access_token',
  'my-new-project',
  true // isPrivate
);
console.log(newRepo.full_name); // "username/my-new-project"
```

**Invite a Collaborator**
Accepts a username on every platform, or an email on GitLab. Maps roles across platforms (`read`, `write`, `admin`).
```typescript
await git.inviteUser(
  'your_access_token',
  'org/my-repo',
  'developer-username',
  'write'
);
```

> **Email invitations** are supported on GitLab only. On GitHub, Forgejo, and Gitea, pass a username. Forgejo and Gitea throw `forgejo_invite_requires_username` if the identifier contains an `@`.

**Read a File & List Contents**
```typescript
const file = await git.getFile('token', 'org/repo', 'src/index.ts', 'main');
if (file.exists) console.log(file.content); // Decoded UTF-8 string

const contents = await git.getContents('token', 'org/repo', 'src/', 'main');
// [ { name: 'components', type: 'dir', path: 'src/components' }, ... ]
```

### Merge Requests (Pull Requests)

Creates a PR/MR between two branches and returns the web URL.

```typescript
const mr = await git.openMergeRequest('your_access_token', {
  repoFullName: 'org/repo',
  sourceBranch: 'feature-branch',
  targetBranch: 'main',
  title: 'Fix audio volume',
  body: 'Generated by AI',
});

console.log('PR created at:', mr.url);
```

---

## Core Git Operations (Clone, Commit, Push)

For heavy operations, the library provides wrappers around native `git` commands. These are highly secured, supporting strict protocol whitelisting (`protocol.ext.allow=never`), disk limits, and isolated home directories.

### 1. Clone a Repository

Clones a repo via HTTPS. Supports shallow clones for branches, targeted fetches for specific commit SHAs, and automatic cleanup on failure.

```typescript
import { cloneRepo } from 'git-adapter';

await cloneRepo({
  url: 'https://github.com/org/repo.git',
  ref: 'main', // or a specific commit SHA
  dest: '/tmp/workspace/repo',
  platform: 'github',
  tokens: {
    githubToken: 'ghp_xxx',
  },
  timeoutMs: 60000,
  maxBytes: 500 * 1024 * 1024, // 500MB limit
});
```

Cloning from Codeberg works the same way:

```typescript
await cloneRepo({
  url: 'https://codeberg.org/org/repo.git',
  ref: 'main',
  dest: '/tmp/workspace/repo',
  platform: 'codeberg',
  tokens: {
    codebergToken: 'your_codeberg_token',
  },
});
```

### 2. Commit and Push

Writes a file into the cloned workspace, commits it to a new branch, and pushes it to the remote.

```typescript
import { commitFileAndPush } from 'git-adapter';

await commitFileAndPush({
  dest: '/tmp/workspace/repo',
  branch: 'ffmpeglab/fix-123',
  filePath: 'src/render.sh',
  fileContent: 'ffmpeg -i input.mp4 output.mp4',
  commitMessage: 'Update render script',
  platform: 'github',
  author: { name: 'AI Bot', email: 'bot@example.com' },
  tokens: {
    githubToken: 'ghp_xxx',
  },
});
```

### Token Configuration

When using `cloneRepo` or `commitFileAndPush`, pass the tokens relevant to your platforms:

```typescript
tokens: {
  githubToken: process.env.GITHUB_TOKEN,
  gitlabComToken: process.env.GITLAB_COM_TOKEN,
  gitlabCustomToken: process.env.GITLAB_CUSTOM_TOKEN,
  codebergToken: process.env.CODEBERG_TOKEN,
  forgejoCustomToken: process.env.FORGEJO_CUSTOM_TOKEN,
  giteaToken: process.env.GITEA_TOKEN,
  giteaCustomToken: process.env.GITEA_CUSTOM_TOKEN,
}
```

| Platform | Token key |
| :--- | :--- |
| `github` | `githubToken` |
| `gitlab` | `gitlabComToken` |
| `gitlab.custom` | `gitlabCustomToken` |
| `codeberg` | `codebergToken` |
| `forgejo.custom` | `forgejoCustomToken` |
| `gitea` | `giteaToken` |
| `gitea.custom` | `giteaCustomToken` |

---

## How It Works (Under the Hood)

### Role Mapping
The library normalizes roles across platforms:
- `read` -> GitHub `pull`, GitLab `Reporter (20)`, Forgejo/Gitea `read`
- `write` -> GitHub `push`, GitLab `Developer (30)`, Forgejo/Gitea `write`
- `admin` -> GitHub `admin`, GitLab `Maintainer (40)`, Forgejo/Gitea `admin`

### Authentication
**API adapters** send `Authorization: Bearer <token>` on GitHub, GitLab, Forgejo, and Gitea. Forgejo and Gitea accept personal access tokens and OAuth2 tokens this way on current releases.

**Native Git operations** use HTTPS Basic auth:
- **GitHub**: `Authorization: Basic base64("x-access-token:<token>")`
- **GitLab**: `Authorization: Basic base64("oauth2:<token>")`
- **Codeberg / Forgejo / Gitea**: the token is sent as the HTTPS password

### Error Handling
All adapters throw standard JavaScript `Error` objects with prefix codes for easy debugging:
- `github_api_error:404`
- `gitlab_api_error:401`
- `forgejo_api_error:403` (Codeberg and custom Forgejo)
- `gitea_api_error:401` (Gitea and custom Gitea)
- `gitlab_user_not_found`
- `forgejo_invite_requires_username`
- `repo_too_large`

## License

MIT License. See [LICENSE](LICENSE) for details.