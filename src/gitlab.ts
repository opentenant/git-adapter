import { GitAdapter, GitFile, DirEntry, InviteRole, MergeRequestOptions, MergeRequestResult } from './types';

export interface GitLabOptions {
  apiUrl?: string;
  agentUser?: string;
}

export class GitLabAdapter implements GitAdapter {
  protected api: string;
  protected agentUser: string;

  constructor(options: GitLabOptions = {}) {
    this.api = options.apiUrl || 'https://gitlab.com/api/v4';
    this.agentUser = options.agentUser || '';
  }

  protected enc(fullName: string) {
    return encodeURIComponent(fullName);
  }

  protected async req(token: string, url: string, init?: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    if (!res.ok) throw new Error(`gitlab_api_error:${res.status}`);

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  getAgentUser(): string {
    return this.agentUser;
  }

  async getRepo(token: string, fullName: string) {
    return this.req(token, `${this.api}/projects/${this.enc(fullName)}`);
  }

  async getFile(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<GitFile> {
    const res = await fetch(
      `${this.api}/projects/${this.enc(fullName)}/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { content: '', exists: false };
    const data = await res.json();
    return {
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      sha: data.last_commit_id,
      exists: true,
    };
  }

  async listRepos(token: string) {
    const projects: any[] = [];
    let nextPage: string | null = '1';

    while (nextPage) {
      const res = await fetch(
        `${this.api}/projects?membership=true&per_page=100&order_by=last_activity_at&page=${nextPage}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`gitlab_api_error:${res.status}`);

      const data = await res.json();
      projects.push(...data);

      const next = res.headers.get('X-Next-Page');
      nextPage = next && next !== '' ? next : null;
    }

    return projects.map((p: any) => ({
      full_name: p.path_with_namespace.replace(/^\//, ''),
      default_branch: p.default_branch,
    }));
  }

  async getContents(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<DirEntry[]> {
    const data = await this.req(
      token,
      `${this.api}/projects/${this.enc(fullName)}/repository/tree?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}&per_page=100`,
    );
    return data.map((e: any) => ({
      name: e.name,
      type: e.type === 'tree' ? 'dir' : 'file',
      path: e.path,
    }));
  }

  async getProfile(token: string) {
    const p = await this.req(token, `${this.api}/user`);
    return { login: p.username, avatar_url: p.avatar_url };
  }

  async createRepo(token: string, name: string, isPrivate = true) {
    const data = await this.req(token, `${this.api}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        visibility: isPrivate ? 'private' : 'public',
        initialize_with_readme: true,
      }),
    });
    return {
      full_name: data.path_with_namespace.replace(/^\//, ''),
      default_branch: data.default_branch || 'main',
    };
  }

  async inviteUser(
    token: string,
    fullName: string,
    userIdentifier: string,
    role: InviteRole = 'write',
  ): Promise<void> {
    const accessLevelMap: Record<InviteRole, number> = {
      read: 20,
      write: 30,
      admin: 40,
    };
    const accessLevel = accessLevelMap[role];

    if (userIdentifier.includes('@')) {
      await this.req(
        token,
        `${this.api}/projects/${this.enc(fullName)}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userIdentifier,
            access_level: accessLevel,
          }),
        },
      );
    } else {
      const users = await this.req(
        token,
        `${this.api}/users?username=${encodeURIComponent(userIdentifier)}`,
      );
      if (!users || users.length === 0) {
        throw new Error('gitlab_user_not_found');
      }
      const userId = users[0].id;

      await this.req(
        token,
        `${this.api}/projects/${this.enc(fullName)}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, access_level: accessLevel }),
        },
      );
    }
  }
  async openMergeRequest(
    token: string,
    options: MergeRequestOptions,
  ): Promise<MergeRequestResult> {
    const data = await this.req(
      token,
      `${this.api}/projects/${this.enc(options.repoFullName)}/merge_requests`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_branch: options.sourceBranch,
          target_branch: options.targetBranch,
          title: options.title,
          description: options.body || '',
        }),
      },
    );
    
    return { url: data.web_url };
  }

}

/**
 * Adapter for a custom self-hosted GitLab instance.
 * Requires the apiUrl to be passed in (e.g., 'https://gitlab.mycompany.com/api/v4').
 */
export class CustomGitLabAdapter extends GitLabAdapter {
  constructor(options: GitLabOptions) {
    super(options);
  }
}