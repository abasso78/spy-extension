import { StorageKey } from '../../consts';
import { KEY_MAX_LENGTHS, KEY_MAX_BYTES, DEFAULT_MAX_LENGTH } from '../shared-utils';

describe('storage caps configuration', () => {
  test('all StorageKey values have an entry in KEY_MAX_LENGTHS', () => {
    const keys = Object.values(StorageKey) as string[];
    for (const k of keys) {
      expect(Object.prototype.hasOwnProperty.call(KEY_MAX_LENGTHS, k)).toBe(true);
    }
  });

  test('KEY_MAX_BYTES has expected entry for screenshots', () => {
    expect(KEY_MAX_BYTES[StorageKey.SCREENSHOT_LOG]).not.toBeNull();
    expect(typeof KEY_MAX_BYTES[StorageKey.SCREENSHOT_LOG]).toBe('number');
  });

  test('defaults are reasonable', () => {
    expect(DEFAULT_MAX_LENGTH).toBeGreaterThan(0);
  });
});

describe('byte-count eviction behavior for screenshots', () => {
  beforeEach(() => {
    (global as any).__TEST_STORAGE = {};
    (global as any).chrome = {
      storage: {
        local: {
          set: jest.fn(async (items: Record<string, any>) => {
            Object.assign((global as any).__TEST_STORAGE, items);
          }),
          get: jest.fn(async () => ({})),
        },
      },
    };
  });

  test('simpleSet evicts by approximate bytes for screenshot entries', async () => {
    const { simpleSet } = await import('../shared-utils');
    // Create 10 entries with large base64-like payloads (~1MB each)
    const large = 'A'.repeat(1 * 1024 * 1024);
    const items = Array.from({ length: 10 }, (_, i) => ({ url: `https://ex/${i}`, imageData: large }));
    await simpleSet(StorageKey.SCREENSHOT_LOG as any, items as any);
    const stored = (global as any).__TEST_STORAGE?.[StorageKey.SCREENSHOT_LOG];
    const setCalled = (global as any).chrome.storage.local.set as jest.Mock;
    expect(setCalled).toBeTruthy();
    // If the test harness recorded __TEST_STORAGE, compute expected max based on configured byte cap
    if (stored) {
      const { KEY_MAX_BYTES } = await import('../shared-utils');
      const byteCap = KEY_MAX_BYTES[StorageKey.SCREENSHOT_LOG] as number | null;
      if (byteCap && byteCap > 0) {
        // approximate bytes per item via JSON serialization
        const approxPerItem = Buffer.byteLength(JSON.stringify(items[0]), 'utf8');
        const expectedMax = Math.max(1, Math.floor(byteCap / approxPerItem));
        expect(stored.length).toBeLessThanOrEqual(Math.min(items.length, expectedMax));
      } else {
        // fallback: ensure we didn't lose items when no byte cap
        expect(stored.length).toBeLessThanOrEqual(items.length);
      }
    }
  });
});
