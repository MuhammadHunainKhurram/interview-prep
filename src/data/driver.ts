/**
 * Minimal key-value storage the repositories are built on. chrome.storage.local in
 * the extension, an in-memory map in tests.
 */
export interface StorageDriver {
  get(keys: readonly string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryDriver implements StorageDriver {
  private readonly data = new Map<string, unknown>();

  async get(keys: readonly string[]) {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (this.data.has(k)) out[k] = structuredClone(this.data.get(k));
    return out;
  }

  async set(items: Record<string, unknown>) {
    for (const [k, v] of Object.entries(items)) this.data.set(k, structuredClone(v));
  }

  async remove(keys: readonly string[]) {
    for (const k of keys) this.data.delete(k);
  }

  async clear() {
    this.data.clear();
  }

  /** Test helper: write raw (possibly invalid) data. */
  async setRaw(key: string, value: unknown) {
    this.data.set(key, value);
  }
}
