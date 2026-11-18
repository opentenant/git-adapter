import { Platform, GitAdapter } from './types';
import { GitHubAdapter, GitHubOptions } from './github';
import { GitLabAdapter, CustomGitLabAdapter, GitLabOptions } from './gitlab';

export interface GitAdapterOptions {
  github?: GitHubOptions;
  gitlab?: GitLabOptions;
  customGitlab?: GitLabOptions;
}

export const getGitAdapter = (
  platform: Platform,
  options: GitAdapterOptions = {},
): GitAdapter => {
  if (platform === 'github') {
    return new GitHubAdapter(options.github);
  }
  if (platform === 'gitlab.custom') {
    if (!options.customGitlab?.apiUrl) {
      throw new Error('CustomGitlabAdapter requires an apiUrl in options.customGitlab');
    }
    return new CustomGitLabAdapter(options.customGitlab);
  }
  return new GitLabAdapter(options.gitlab);
};