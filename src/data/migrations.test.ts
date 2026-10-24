import { describe, expect, it } from 'vitest';
import { MemoryDriver } from './driver';
import { KEYS, LocalRepositories } from './local-repositories';
import { CURRENT_SCHEMA_VERSION, migrate, SchemaVersionError } from './migrations';

describe('migrations', () => {
  it('is a no-op at the current version', () => {
    const data = { attempts: {} };
    expect(migrate(data, CURRENT_SCHEMA_VERSION)).toBe(data);
  });

  it('refuses data from a newer version', () => {
    expect(() => migrate({}, CURRENT_SCHEMA_VERSION + 1)).toThrow(SchemaVersionError);
  });

  it('refuses invalid versions', () => {
    expect(() => migrate({}, 0)).toThrow();
    expect(() => migrate({}, 1.5)).toThrow();
  });

  it('writes meta on first run', async () => {
    const driver = new MemoryDriver();
    const repos = new LocalRepositories(driver, () => new Date('2026-01-01T00:00:00.000Z'));
    await repos.attempts.all();
    expect((await driver.get([KEYS.meta])).meta).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      installedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
