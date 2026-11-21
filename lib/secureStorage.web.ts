// Web build: no Keychain. localStorage is fine for the browser preview only.
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* storage unavailable */ }
  },
  async removeItem(key: string): Promise<void> {
    try { globalThis.localStorage?.removeItem(key); } catch { /* storage unavailable */ }
  },
};
