import { ForgejoAdapter, ForgejoOptions } from './forgejo';

export type GiteaOptions = ForgejoOptions;

/** Gitea shares Forgejo's API (/api/v1), so only the defaults differ. */
export class GiteaAdapter extends ForgejoAdapter {
  protected errPrefix = 'gitea_api_error';

  constructor(options: GiteaOptions = {}) {
    super({
      ...options,
      apiUrl: options.apiUrl || 'https://gitea.com/api/v1',
    });
  }
}

/**
 * Adapter for a self-hosted Gitea instance.
 * Requires the apiUrl to be passed in (e.g., 'https://git.mycompany.com/api/v1').
 */
export class CustomGiteaAdapter extends GiteaAdapter {
  constructor(options: GiteaOptions) {
    super(options);
  }
}