import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';

describe('loadConfig', () => {
  it('defaults to local storage', () => {
    expect(loadConfig({}).WXT_STORAGE_BACKEND).toBe('local');
  });

  it('requires Supabase settings when that backend is selected', () => {
    expect(() => loadConfig({ WXT_STORAGE_BACKEND: 'supabase' })).toThrow(/WXT_SUPABASE_URL/);
  });

  it('only allows https Supabase URLs', () => {
    expect(() =>
      loadConfig({
        WXT_STORAGE_BACKEND: 'supabase',
        WXT_SUPABASE_URL: 'http://x.supabase.co',
        WXT_SUPABASE_ANON_KEY: 'k',
      }),
    ).toThrow();
  });

  it('rejects unknown backends', () => {
    expect(() => loadConfig({ WXT_STORAGE_BACKEND: 'mysql' })).toThrow();
  });
});
