import type { z } from 'zod';
import {
  AttemptSchema,
  DaySnapshotSchema,
  RestDaySchema,
  TimerSchema,
  UiPrefsSchema,
  UnlistedProblemSchema,
  DEFAULT_UI_PREFS,
  type UiPrefs,
} from '@/core/model/records';
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '@/core/model/settings';
import type { StorageDriver } from './driver';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';
import type {
  DataSet,
  Meta,
  QuarantineEntry,
  RecordRepository,
  Repositories,
  SafetyCopy,
} from './repositories';

export const KEYS = {
  meta: 'meta',
  settings: 'settings',
  attempts: 'attempts',
  restDays: 'restDays',
  snapshots: 'snapshots',
  timers: 'timers',
  unlisted: 'unlisted',
  uiPrefs: 'uiPrefs',
  quarantine: 'quarantine',
  safetyCopy: 'safetyCopy',
} as const;

const DATA_KEYS = [KEYS.settings, KEYS.attempts, KEYS.restDays, KEYS.snapshots, KEYS.unlisted];
const MAX_QUARANTINE = 200;

type Store = Record<string, unknown>;

function asStore(value: unknown): Store {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Store) : {};
}

/**
 * Repositories over chrome.storage.local (or any StorageDriver).
 *
 * Every read is validated. Records that fail validation are never deleted: they're
 * moved to a quarantine area (which can be exported) and the rest of the data keeps
 * working.
 */
export class LocalRepositories implements Repositories {
  readonly attempts: RecordRepository<z.infer<typeof AttemptSchema>>;
  readonly restDays: RecordRepository<z.infer<typeof RestDaySchema>>;
  readonly snapshots: RecordRepository<z.infer<typeof DaySnapshotSchema>>;
  readonly timers: RecordRepository<z.infer<typeof TimerSchema>>;
  readonly unlisted: RecordRepository<z.infer<typeof UnlistedProblemSchema>>;

  private ready: Promise<void> | undefined;

  constructor(
    private readonly driver: StorageDriver,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.attempts = this.collection(KEYS.attempts, AttemptSchema, (r) => r.id);
    this.restDays = this.collection(KEYS.restDays, RestDaySchema, (r) => r.logicalDay);
    this.snapshots = this.collection(KEYS.snapshots, DaySnapshotSchema, (r) => r.logicalDay);
    this.timers = this.collection(KEYS.timers, TimerSchema, (r) => r.problemId);
    this.unlisted = this.collection(KEYS.unlisted, UnlistedProblemSchema, (r) => r.id);
  }

  /** Runs migrations once per instance before any access. */
  private init(): Promise<void> {
    this.ready ??= (async () => {
      const { meta } = await this.driver.get([KEYS.meta]);
      if (!meta) {
        const fresh: Meta = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          installedAt: this.now().toISOString(),
        };
        await this.driver.set({ [KEYS.meta]: fresh });
        return;
      }
      const m = meta as Meta;
      if (m.schemaVersion === CURRENT_SCHEMA_VERSION) return;
      const raw = await this.driver.get(DATA_KEYS);
      const migrated = migrate(raw, m.schemaVersion);
      await this.driver.set({
        ...migrated,
        [KEYS.meta]: { ...m, schemaVersion: CURRENT_SCHEMA_VERSION },
      });
    })();
    // Let a later call retry if initialization failed.
    this.ready.catch(() => (this.ready = undefined));
    return this.ready;
  }

  private async read(key: string): Promise<unknown> {
    await this.init();
    return (await this.driver.get([key]))[key];
  }

  private async quarantineAdd(entries: QuarantineEntry[]): Promise<void> {
    if (!entries.length) return;
    const { [KEYS.quarantine]: existing } = await this.driver.get([KEYS.quarantine]);
    const list = Array.isArray(existing) ? (existing as QuarantineEntry[]) : [];
    await this.driver.set({ [KEYS.quarantine]: [...list, ...entries].slice(-MAX_QUARANTINE) });
  }

  private collection<S extends z.ZodType>(
    key: string,
    schema: S,
    keyOf: (r: z.infer<S>) => string,
  ): RecordRepository<z.infer<S>> {
    type T = z.infer<S>;
    const load = async (): Promise<Map<string, T>> => {
      const store = asStore(await this.read(key));
      const valid = new Map<string, T>();
      const bad: QuarantineEntry[] = [];
      for (const [k, raw] of Object.entries(store)) {
        const parsed = schema.safeParse(raw);
        if (parsed.success && keyOf(parsed.data) === k) valid.set(k, parsed.data);
        else
          bad.push({
            collection: key,
            reason: parsed.success
              ? 'Key mismatch'
              : (parsed.error.issues[0]?.message ?? 'Invalid'),
            raw,
            quarantinedAt: this.now().toISOString(),
          });
      }
      if (bad.length) {
        await this.quarantineAdd(bad);
        await this.driver.set({ [key]: Object.fromEntries(valid) });
      }
      return valid;
    };
    const save = (map: Map<string, T>) => this.driver.set({ [key]: Object.fromEntries(map) });

    return {
      all: async () => [...(await load()).values()],
      get: async (k) => (await load()).get(k),
      put: async (record) => {
        const parsed = schema.parse(record) as T;
        const map = await load();
        map.set(keyOf(parsed), parsed);
        await save(map);
      },
      remove: async (k) => {
        const map = await load();
        if (map.delete(k)) await save(map);
      },
    };
  }

  async meta(): Promise<Meta> {
    return (await this.read(KEYS.meta)) as Meta;
  }

  settings = {
    get: async (): Promise<Settings> => {
      const raw = await this.read(KEYS.settings);
      if (raw === undefined) return DEFAULT_SETTINGS;
      // Fill in settings added in later versions.
      const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...asStore(raw) });
      if (parsed.success) return parsed.data;
      await this.quarantineAdd([
        {
          collection: KEYS.settings,
          reason: parsed.error.issues[0]?.message ?? 'Invalid settings',
          raw,
          quarantinedAt: this.now().toISOString(),
        },
      ]);
      await this.driver.remove([KEYS.settings]);
      return DEFAULT_SETTINGS;
    },
    save: async (settings: Settings) => {
      await this.init();
      await this.driver.set({ [KEYS.settings]: SettingsSchema.parse(settings) });
    },
  };

  uiPrefs = {
    get: async (): Promise<UiPrefs> => {
      const parsed = UiPrefsSchema.safeParse(await this.read(KEYS.uiPrefs));
      return parsed.success ? parsed.data : DEFAULT_UI_PREFS;
    },
    save: async (prefs: UiPrefs) => {
      await this.init();
      await this.driver.set({ [KEYS.uiPrefs]: UiPrefsSchema.parse(prefs) });
    },
  };

  quarantine = {
    list: async (): Promise<QuarantineEntry[]> => {
      const raw = await this.read(KEYS.quarantine);
      return Array.isArray(raw) ? (raw as QuarantineEntry[]) : [];
    },
    clear: async () => {
      await this.driver.remove([KEYS.quarantine]);
    },
  };

  async exportData(): Promise<DataSet> {
    return {
      settings: await this.settings.get(),
      attempts: await this.attempts.all(),
      restDays: await this.restDays.all(),
      snapshots: await this.snapshots.all(),
      unlisted: await this.unlisted.all(),
    };
  }

  async replaceData(data: DataSet): Promise<void> {
    await this.init();
    const byKey = <T>(xs: T[], k: (x: T) => string) => Object.fromEntries(xs.map((x) => [k(x), x]));
    await this.driver.set({
      [KEYS.settings]: SettingsSchema.parse(data.settings),
      [KEYS.attempts]: byKey(
        data.attempts.map((a) => AttemptSchema.parse(a)),
        (a) => a.id,
      ),
      [KEYS.restDays]: byKey(
        data.restDays.map((r) => RestDaySchema.parse(r)),
        (r) => r.logicalDay,
      ),
      [KEYS.snapshots]: byKey(
        data.snapshots.map((s) => DaySnapshotSchema.parse(s)),
        (s) => s.logicalDay,
      ),
      [KEYS.unlisted]: byKey(
        data.unlisted.map((u) => UnlistedProblemSchema.parse(u)),
        (u) => u.id,
      ),
      [KEYS.timers]: {},
    });
  }

  async saveSafetyCopy(label: string): Promise<void> {
    const copy: SafetyCopy = {
      label,
      savedAt: this.now().toISOString(),
      data: await this.exportData(),
    };
    await this.driver.set({
      [KEYS.safetyCopy]: { ...copy, schemaVersion: CURRENT_SCHEMA_VERSION },
    });
  }

  async getSafetyCopy(): Promise<SafetyCopy | null> {
    const raw = asStore(await this.read(KEYS.safetyCopy));
    if (typeof raw.label !== 'string' || typeof raw.savedAt !== 'string' || !raw.data) return null;
    return { label: raw.label, savedAt: raw.savedAt, data: raw.data as DataSet };
  }

  async wipe(): Promise<void> {
    const { [KEYS.safetyCopy]: copy } = await this.driver.get([KEYS.safetyCopy]);
    await this.driver.clear();
    if (copy) await this.driver.set({ [KEYS.safetyCopy]: copy });
    this.ready = undefined;
  }
}
