import { browser } from 'wxt/browser';
import type { StorageDriver } from './driver';

export const chromeStorageDriver: StorageDriver = {
  get: (keys) => browser.storage.local.get([...keys]),
  set: (items) => browser.storage.local.set(items),
  remove: (keys) => browser.storage.local.remove([...keys]),
  clear: () => browser.storage.local.clear(),
};
