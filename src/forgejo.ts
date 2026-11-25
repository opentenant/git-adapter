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

export interface ForgejoOptions {
  apiUrl?: string;
  agentUser?: string;
}

export class ForgejoAdapter implements GitAdapter {
  protected api: string;
  protected agentUser: string;
  protected errPrefix = 'forgejo_api_error';

  constructor(options: ForgejoOptions = {}) {
    this.api = options.apiUrl || 'https://codeberg.org/api/v1';
    this.agentUser = options.agentUser || '';
  }

  /** Encode each path segment but keep the slashes (Forgejo doesn't accept %2F in file paths). */
  protected encPath(path: string) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  protected async req(token: string, url: string, init?: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) throw new Error(`${this.errPrefix}:${res.status}`);

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
        `${this.api}/repos/${fullName}/contents/${this.encPath(path)}?ref=${encodeURIComponent(ref)}`,
      );
      // A directory returns an array, which isn't a file
      if (!data || Array.isArray(data) || data.content == null) {
        return { content: '', exists: false };
      }
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
    url.searchParams.set('limit', perPage.toString()); // Forgejo uses `limit`

    const res: Response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) throw new Error(`${this.errPrefix}:${res.status}`);

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
      `${this.api}/repos/${fullName}/contents/${this.encPath(path)}?ref=${encodeURIComponent(ref)}`,
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
        default_branch: 'main',
      }),
    });
    return {
      full_name: data.full_name,
      default_branch: data.default_branch || 'main',
    };
  }

  async inviteUser(
    token: string,
    fullName: string,
    userIdentifier: string,
    role: InviteRole = 'write',
  ): Promise<void> {
    // Forgejo collaborators are added by username only (no email invitations)
    if (userIdentifier.includes('@')) {
      throw new Error('forgejo_invite_requires_username');
    }

    await this.req(
      token,
      `${this.api}/repos/${fullName}/collaborators/${encodeURIComponent(userIdentifier)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: role }), // read | write | admin
      },
    );
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
}

/**
 * Adapter for a self-hosted Forgejo (or Gitea) instance.
 * Requires the apiUrl to be passed in (e.g., 'https://git.mycompany.com/api/v1').
 */
export class CustomForgejoAdapter extends ForgejoAdapter {
  constructor(options: ForgejoOptions) {
    super(options);
  }
}