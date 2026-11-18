export interface PaginationParams {
  page?: number;
  perPage?: number; // Max 100 for GitHub, GitLab
}

export interface RepoInfo {
  full_name: string;
  default_branch: string;
}

export interface PaginatedRepos {
  data: RepoInfo[];
  hasNextPage: boolean;
  nextPage?: number;
}

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
  listRepos(token: string, params?: PaginationParams): Promise<PaginatedRepos>;
  getRepo(token: string, fullName: string): Promise<any>;
  getFile(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<GitFile>;
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
