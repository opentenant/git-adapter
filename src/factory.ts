import { Platform, GitAdapter } from './types';
import { GitHubAdapter, GitHubOptions } from './github';
import { GitLabAdapter, CustomGitLabAdapter, GitLabOptions } from './gitlab';
import {
  ForgejoAdapter,
  CustomForgejoAdapter,
  ForgejoOptions,
} from './forgejo';
import { GiteaAdapter, CustomGiteaAdapter, GiteaOptions } from './gitea';

export interface GitAdapterOptions {
  github?: GitHubOptions;
  gitlab?: GitLabOptions;
  customGitlab?: GitLabOptions;
  codeberg?: ForgejoOptions;
  customForgejo?: ForgejoOptions;
  gitea?: GiteaOptions;
  customGitea?: GiteaOptions;
}

export const getGitAdapter = (
  platform: Platform,
  options: GitAdapterOptions = {},
): GitAdapter => {
  if (platform === 'github') {
    return new GitHubAdapter(options.github);
  }
  if (platform === 'codeberg') {
    return new ForgejoAdapter(options.codeberg);
  }
  if (platform === 'forgejo.custom') {
    if (!options.customForgejo?.apiUrl) {
      throw new Error(
        'CustomForgejoAdapter requires an apiUrl in options.customForgejo',
      );
    }
    return new CustomForgejoAdapter(options.customForgejo);
  }
  if (platform === 'gitea') {
    return new GiteaAdapter(options.gitea);
  }
  if (platform === 'gitea.custom') {
    if (!options.customGitea?.apiUrl) {
      throw new Error(
        'CustomGiteaAdapter requires an apiUrl in options.customGitea',
      );
    }
    return new CustomGiteaAdapter(options.customGitea);
  }
  if (platform === 'gitlab.custom') {
    if (!options.customGitlab?.apiUrl) {
      throw new Error(
        'CustomGitlabAdapter requires an apiUrl in options.customGitlab',
      );
    }
    return new CustomGitLabAdapter(options.customGitlab);
  }
  return new GitLabAdapter(options.gitlab);
};
