import {
  AppError,
  RequestSchemas,
  type ParsedRequest,
  type RequestType,
  type ResponseEnvelope,
  type ResponseMap,
} from '@/shared/messaging/contract';
import type { TrackerService } from './tracker-service';

type Handlers = {
  [K in RequestType]: (payload: ParsedRequest<K>) => Promise<ResponseMap[K]>;
};

export interface RouterDeps {
  service: TrackerService;
  openDashboard: (route?: string) => Promise<void>;
  onSettingsChanged: () => Promise<void>;
  onDataChanged: () => Promise<void>;
}

export function createHandlers({ service: s, openDashboard, onSettingsChanged, onDataChanged }: RouterDeps): Handlers {
  const after =
    <A, R>(fn: (a: A) => Promise<R>, hook: () => Promise<void>) =>
    async (a: A) => {
      const r = await fn(a);
      await hook();
      return r;
    };
  return {
    'widget/state': (p) => s.widgetState(p),
    'timer/start': (p) => s.timerStart(p),
    'timer/pause': (p) => s.timerPause(p),
    'timer/reset': (p) => s.timerReset(p),
    'attempt/record': (p) => s.recordAttempt(p),
    'attempt/undo': (p) => s.undoAttempt(p),
    'attempt/update': (p) => s.updateAttempt(p),
    'attempt/delete': (p) => s.deleteAttempt(p),
    'today/get': () => s.today(),
    'overview/get': () => s.overview(),
    'problems/get': (p) => s.problems(p),
    'unlisted/get': () => s.unlistedProblems(),
    'reviews/get': () => s.reviews(),
    'history/get': (p) => s.history(p),
    'stats/get': () => s.stats(),
    'settings/get': () => s.getSettings(),
    'settings/save': after((p) => s.saveSettings(p), onSettingsChanged),
    'restDays/get': () => s.restDays(),
    'restDays/add': (p) => s.addRestDay(p),
    'restDays/remove': (p) => s.removeRestDay(p),
    'backup/export': () => s.exportBackup(),
    'backup/preview': (p) => s.previewBackup(p),
    'backup/import': after((p) => s.importBackup(p), onDataChanged),
    'backup/safetyCopy': () => s.safetyCopy(),
    'data/reset': after(() => s.resetAll(), onDataChanged),
    'integrity/get': () => s.integrity(),
    'integrity/clear': () => s.clearIntegrity(),
    'dashboard/open': async (p) => {
      await openDashboard(p.route);
      return null;
    },
  };
}

function isRequestType(t: unknown): t is RequestType {
  return typeof t === 'string' && Object.hasOwn(RequestSchemas, t);
}

/**
 * Validates and dispatches one message. Only messages from this extension's own
 * pages and content scripts are accepted.
 */
export async function dispatch(
  handlers: Handlers,
  message: unknown,
  sender: { id?: string },
  extensionId: string,
): Promise<ResponseEnvelope> {
  try {
    if (sender.id !== extensionId) throw new AppError('validation', 'Unknown sender.');
    const m = message as { channel?: unknown; type?: unknown; payload?: unknown } | null;
    if (!m || m.channel !== 'interview-prep' || !isRequestType(m.type))
      throw new AppError('validation', 'Unknown request.');

    const type = m.type;
    const parsed = RequestSchemas[type].safeParse(m.payload ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError('validation', issue ? `${issue.path.join('.') || 'request'}: ${issue.message}` : 'Invalid request.');
    }
    const handler = handlers[type] as (p: unknown) => Promise<unknown>;
    return { ok: true, data: (await handler(parsed.data)) as never };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.toPayload() };
    console.error('[interview-prep] request failed', e);
    return { ok: false, error: { code: 'internal', message: 'Something went wrong. Please try again.' } };
  }
}
