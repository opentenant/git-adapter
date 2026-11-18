import {
  GitAdapter,
  GitFile,
  DirEntry,
  InviteRole,
  MergeRequestOptions,
  MergeRequestResult,
  PaginationParams,
  PaginatedRepos,
} from './types';

export interface GitHubOptions {
  apiUrl?: string;
  agentUser?: string;
}

export class GitHubAdapter implements GitAdapter {
  protected api: string;
  protected agentUser: string;

  constructor(options: GitHubOptions = {}) {
    this.api = options.apiUrl || 'https://api.github.com';
    this.agentUser = options.agentUser || '';
  }

  async openMergeRequest(
    token: string,
    options: MergeRequestOptions,
  ): Promise<MergeRequestResult> {
    const data = await this.req(
      token,
      `${this.api}/repos/${options.repoFullName}/pulls`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: options.title,
          head: options.sourceBranch,
          base: options.targetBranch,
          body: options.body || '',
        }),
      },
    );

    return { url: data.html_url };
  }

  protected async req(token: string, url: string, init?: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) throw new Error(`github_api_error:${res.status}`);
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  getAgentUser(): string {
    return this.agentUser;
  }

  async getRepo(token: string, fullName: string) {
    return this.req(token, `${this.api}/repos/${fullName}`);
  }

  async getFile(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<GitFile> {
    try {
      const data = await this.req(
        token,
        `${this.api}/repos/${fullName}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
      );
      return {
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        sha: data.sha,
        exists: true,
      };
    } catch {
      return { content: '', exists: false };
    }
  }

  async listRepos(
    token: string,
    params: PaginationParams = {},
  ): Promise<PaginatedRepos> {
    const page = params.page || 1;
    const perPage = params.perPage || 30;

    const url = new URL(`${this.api}/user/repos`);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', perPage.toString());
    url.searchParams.set('sort', 'updated');

    const res: Response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) throw new Error(`github_api_error:${res.status}`);

    const repos = await res.json();

    // Parse Link header for next page
    const link = res.headers.get('Link');
    const match = link?.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="next"/);
    const nextPage = match ? parseInt(match[1], 10) : undefined;

    return {
      data: repos.map((r: any) => ({
        full_name: r.full_name,
        default_branch: r.default_branch,
      })),
      hasNextPage: !!nextPage,
      nextPage,
    };
  }

  async getContents(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<DirEntry[]> {
    const data = await this.req(
      token,
      `${this.api}/repos/${fullName}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
    );
    if (!Array.isArray(data)) return []; // path is a file
    return data.map((e: any) => ({
      name: e.name,
      type: e.type === 'dir' ? 'dir' : 'file',
      path: e.path,
    }));
  }

  async getProfile(token: string) {
    const p = await this.req(token, `${this.api}/user`);
    return { login: p.login, avatar_url: p.avatar_url };
  }

  async createRepo(token: string, name: string, isPrivate = true) {
    const data = await this.req(token, `${this.api}/user/repos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        private: isPrivate,
        auto_init: true,
      }),
    });
    return {
      full_name: data.full_name,
      default_branch: data.default_branch,
    };
  }

  async inviteUser(
    token: string,
    fullName: string,
    userIdentifier: string,
    role: InviteRole = 'write',
  ): Promise<void> {
    const permissionMap: Record<InviteRole, string> = {
      read: 'pull',
      write: 'push',
      admin: 'admin',
    };

    await this.req(
      token,
      `${this.api}/repos/${fullName}/collaborators/${encodeURIComponent(userIdentifier)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: permissionMap[role] }),
      },
    );
  }
}
