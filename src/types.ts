export interface GitFile {
  content: string;
  sha?: string;
  exists: boolean;
}

export interface DirEntry {
  name: string;
  type: 'dir' | 'file';
  path: string;
}

export type InviteRole = 'read' | 'write' | 'admin';

export type Platform = 'github' | 'gitlab' | 'gitlab.custom';

export interface MergeRequestOptions {
  repoFullName: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  body?: string;
}

export interface MergeRequestResult {
  url: string;
}

export interface GitAdapter {
  getRepo(token: string, fullName: string): Promise<any>;
  getFile(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<GitFile>;
  listRepos(
    token: string,
  ): Promise<{ full_name: string; default_branch: string }[]>;
  getContents(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<DirEntry[]>;
  getAgentUser(): string;
  getProfile(token: string): Promise<{ login: string; avatar_url?: string }>;
  createRepo(
    token: string,
    name: string,
    isPrivate?: boolean,
  ): Promise<{ full_name: string; default_branch: string }>;
  inviteUser(
    token: string,
    fullName: string,
    userIdentifier: string,
    role?: InviteRole,
  ): Promise<void>;
  openMergeRequest(
    token: string,
    options: MergeRequestOptions,
  ): Promise<MergeRequestResult>;
}