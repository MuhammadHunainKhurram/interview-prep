import type {
  Attempt,
  DaySnapshot,
  RestDay,
  Timer,
  UiPrefs,
  UnlistedProblem,
} from '@/core/model/records';
import type { Settings } from '@/core/model/settings';

/** A collection of records addressed by a string key. */
export interface RecordRepository<T> {
  all(): Promise<T[]>;
  get(key: string): Promise<T | undefined>;
  put(record: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface QuarantineEntry {
  collection: string;
  reason: string;
  raw: unknown;
  quarantinedAt: string;
}

export interface Meta {
  schemaVersion: number;
  installedAt: string;
}

/** All user data in one portable shape (used for backups and replace-all). */
export interface DataSet {
  settings: Settings;
  attempts: Attempt[];
  restDays: RestDay[];
  snapshots: DaySnapshot[];
  unlisted: UnlistedProblem[];
}

/**
 * The storage boundary. The local implementation uses chrome.storage; a future
 * Supabase implementation would implement the same interface.
 */
export interface Repositories {
  meta(): Promise<Meta>;
  settings: {
    get(): Promise<Settings>;
    save(settings: Settings): Promise<void>;
  };
  attempts: RecordRepository<Attempt>;
  restDays: RecordRepository<RestDay>;
  snapshots: RecordRepository<DaySnapshot>;
  timers: RecordRepository<Timer>;
  unlisted: RecordRepository<UnlistedProblem>;
  uiPrefs: {
    get(): Promise<UiPrefs>;
    save(prefs: UiPrefs): Promise<void>;
  };
  quarantine: {
    list(): Promise<QuarantineEntry[]>;
    clear(): Promise<void>;
  };
  exportData(): Promise<DataSet>;
  /** Atomically replaces all user data. Timers are cleared. */
  replaceData(data: DataSet): Promise<void>;
  /** Saves a copy of the current data before a destructive operation. */
  saveSafetyCopy(label: string): Promise<void>;
  getSafetyCopy(): Promise<SafetyCopy | null>;
  /** Deletes all data except the safety copy. */
  wipe(): Promise<void>;
}

export interface SafetyCopy {
  label: string;
  savedAt: string;
  data: DataSet;
}
