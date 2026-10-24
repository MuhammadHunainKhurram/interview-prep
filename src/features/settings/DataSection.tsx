import { useRef, useState } from 'react';
import { MAX_BACKUP_BYTES } from '@/data/backup';
import { errorMessage, send } from '@/shared/messaging/client';
import type { BackupPreview } from '@/shared/messaging/contract';
import { Button, Card, CardTitle, ErrorNote } from '@/shared/ui/components';
import { formatDateTime, plural } from '@/shared/ui/format';
import { useRequest } from '@/shared/ui/hooks';

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ text: string; preview: BackupPreview } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showReset, setShowReset] = useState(false);
  const integrity = useRequest('integrity/get', {});

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const onFile = (file: File | undefined) =>
    run(async () => {
      if (!file) return;
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup file is larger than 5 MB.');
      const text = await file.text();
      const preview = await send('backup/preview', { text });
      setPending({ text, preview });
    }).finally(() => {
      if (fileRef.current) fileRef.current.value = '';
    });

  return (
    <Card>
      <CardTitle>Your data</CardTitle>
      <p className="mb-4 text-sm text-muted">
        Everything is stored only in this browser. Export a backup regularly, especially before
        reinstalling.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          tone="accent"
          onClick={() =>
            void run(async () => {
              const { filename, text } = await send('backup/export', {});
              download(filename, text);
            })
          }
        >
          Export backup
        </Button>
        <Button onClick={() => fileRef.current?.click()}>Import backup</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          onClick={() =>
            void run(async () => {
              const copy = await send('backup/safetyCopy', {});
              if (!copy)
                setMessage(
                  'No safety copy yet. One is saved automatically before every import or reset.',
                );
              else download(copy.filename, copy.text);
            })
          }
        >
          Download safety copy
        </Button>
        <Button tone="red" onClick={() => setShowReset(true)}>
          Reset everything
        </Button>
      </div>

      {pending && (
        <div className="mt-4 rounded-xl border-2 border-yellow bg-yellow-soft p-4 text-sm">
          <p className="font-bold">Replace all current data with this backup?</p>
          <p className="mt-1">
            Exported {formatDateTime(pending.preview.exportedAt)} ·{' '}
            {plural(pending.preview.attempts, 'attempt')} on{' '}
            {plural(pending.preview.problems, 'problem')} ·{' '}
            {plural(pending.preview.restDays, 'rest day')}.
          </p>
          <p className="mt-1 text-muted">A safety copy of your current data is saved first.</p>
          <div className="mt-3 flex gap-2">
            <Button
              tone="accent"
              size="sm"
              onClick={() =>
                void run(async () => {
                  await send('backup/import', { text: pending.text });
                  setPending(null);
                  setMessage('Backup imported.');
                })
              }
            >
              Replace my data
            </Button>
            <Button size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showReset && (
        <div className="mt-4 rounded-xl border-2 border-red bg-red-soft p-4 text-sm">
          <p className="font-bold">This deletes all attempts, settings and rest days.</p>
          <p className="mt-1">
            A safety copy is kept so you can download it afterwards. Type DELETE to confirm.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              aria-label="Type DELETE to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="rounded-xl border-2 border-border bg-surface px-3 py-1.5 font-bold"
            />
            <Button
              tone="red"
              size="sm"
              disabled={confirmText !== 'DELETE'}
              onClick={() =>
                void run(async () => {
                  await send('data/reset', { confirm: 'DELETE' });
                  setShowReset(false);
                  setConfirmText('');
                  setMessage('All data was reset.');
                })
              }
            >
              Delete everything
            </Button>
            <Button size="sm" onClick={() => setShowReset(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm font-bold text-green">
          {message}
        </p>
      )}
      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}

      {integrity.data && integrity.data.entries.length > 0 && (
        <div className="mt-6 rounded-xl border-2 border-yellow p-4 text-sm">
          <p className="font-bold">
            {plural(integrity.data.entries.length, 'record')} couldn't be read and were set aside
          </p>
          <p className="mt-1 text-muted">
            Your other data is fine. Download them to inspect or repair, then clear the list.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                download(
                  'interview-prep-quarantine.json',
                  JSON.stringify(integrity.data!.entries, null, 2),
                )
              }
            >
              Download
            </Button>
            <Button
              size="sm"
              onClick={() => void run(async () => void (await send('integrity/clear', {})))}
            >
              Clear list
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
