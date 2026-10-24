import type { AppConfig } from '@/shared/config/env';
import { chromeStorageDriver } from './chrome-driver';
import { LocalRepositories } from './local-repositories';
import type { Repositories } from './repositories';

export function createRepositories(config: AppConfig): Repositories {
  switch (config.WXT_STORAGE_BACKEND) {
    case 'local':
      return new LocalRepositories(chromeStorageDriver);
    case 'supabase':
      // Implement `Repositories` over Supabase (with row-level security) and return it here.
      throw new Error('The Supabase backend is not implemented yet. Set WXT_STORAGE_BACKEND=local.');
  }
}
