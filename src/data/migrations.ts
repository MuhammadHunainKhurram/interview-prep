/**
 * Versioned schema migrations. Each migration upgrades the raw stored data from
 * version N to N+1. They run on startup and on backup import, before validation.
 *
 * To change the data shape:
 *   1. bump CURRENT_SCHEMA_VERSION
 *   2. add MIGRATIONS[previousVersion] transforming the raw data
 *   3. add a fixture test in migrations.test.ts
 */
export const CURRENT_SCHEMA_VERSION = 1;

export type RawData = Record<string, unknown>;

export const MIGRATIONS: Record<number, (data: RawData) => RawData> = {
  // 1: (data) => ({ ...data, /* v1 → v2 changes */ }),
};

export class SchemaVersionError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(
      `Data is from a newer version of the extension (schema ${found}; this version supports ${supported}). Update the extension first.`,
    );
  }
}

export function migrate(data: RawData, fromVersion: number): RawData {
  if (!Number.isInteger(fromVersion) || fromVersion < 1)
    throw new Error(`Invalid schema version: ${String(fromVersion)}`);
  if (fromVersion > CURRENT_SCHEMA_VERSION)
    throw new SchemaVersionError(fromVersion, CURRENT_SCHEMA_VERSION);
  let out = data;
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Missing migration from schema ${v}`);
    out = step(out);
  }
  return out;
}
