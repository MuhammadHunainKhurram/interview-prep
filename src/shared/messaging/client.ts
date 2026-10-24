import { browser } from 'wxt/browser';
import {
  AppError,
  type RequestEnvelope,
  type RequestPayload,
  type RequestType,
  type ResponseEnvelope,
  type ResponseMap,
} from './contract';

/** Sends a typed request to the background worker. Rejects with AppError. */
export async function send<K extends RequestType>(
  type: K,
  payload: RequestPayload<K>,
): Promise<ResponseMap[K]> {
  const envelope: RequestEnvelope<K> = { channel: 'interview-prep', type, payload };
  let res: ResponseEnvelope<K> | undefined;
  try {
    res = (await browser.runtime.sendMessage(envelope)) as ResponseEnvelope<K> | undefined;
  } catch (e) {
    // Happens when the extension was reloaded while a page still had the old script.
    throw new AppError(
      'internal',
      e instanceof Error && /context invalidated/i.test(e.message)
        ? 'The extension was updated. Refresh this page.'
        : "Couldn't reach the extension. Try again.",
    );
  }
  if (!res) throw new AppError('internal', 'No response from the extension.');
  if (!res.ok) {
    const { code, message, ...extra } = res.error;
    throw new AppError(code, message, extra);
  }
  return res.data;
}

export function errorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  return 'Something went wrong.';
}
