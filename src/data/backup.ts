import { z } from 'zod';
import {
  AttemptSchema,
  DaySnapshotSchema,
  RestDaySchema,
  UnlistedProblemSchema,
} from '@/core/model/records';
import { DEFAULT_SETTINGS, SettingsSchema } from '@/core/model/settings';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';
import type { DataSet } from './repositories';

export const BACKUP_FORMAT = 'interview-prep-backup';
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_RECORDS = 100_000;

const BackupEnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()),
});

const DataSetSchema = z
  .object({
    settings: z.unknown().transform((s) => ({ ...DEFAULT_SETTINGS, ...(s as object) })).pipe(SettingsSchema),
    attempts: z.array(AttemptSchema).max(MAX_RECORDS),
    restDays: z.array(RestDaySchema).max(MAX_RECORDS),
    snapshots: z.array(DaySnapshotSchema).max(MAX_RECORDS),
    unlisted: z.array(UnlistedProblemSchema).max(MAX_RECORDS),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    for (const a of d.attempts) {
      if (ids.has(a.id)) ctx.addIssue({ code: 'custom', message: `Duplicate attempt id ${a.id}` });
      ids.add(a.id);
    }
  });

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  data: DataSet;
}

export function createBackup(data: DataSet, now: Date): Backup {
  return { format: BACKUP_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export class BackupError extends Error {}

/** Parses, migrates and validates a backup file's text. Throws BackupError with a readable message. */
export function parseBackup(text: string): Backup {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('Backup file is larger than 5 MB.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't valid JSON.");
  }
  const envelope = BackupEnvelopeSchema.safeParse(json);
  if (!envelope.success) throw new BackupError("That file isn't an Interview Prep backup.");

  let migrated;
  try {
    migrated = migrate(envelope.data.data, envelope.data.schemaVersion);
  } catch (e) {
    throw new BackupError(e instanceof Error ? e.message : 'Unsupported backup version.');
  }

  const data = DataSetSchema.safeParse(migrated);
  if (!data.success) {
    const issue = data.error.issues[0];
    throw new BackupError(
      `Backup failed validation${issue ? ` at ${issue.path.join('.') || 'root'}: ${issue.message}` : ''}.`,
    );
  }
  return { ...envelope.data, format: BACKUP_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION, data: data.data };
}
