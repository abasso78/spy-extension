import { simpleSet, simpleGet, simplePrepend, simpleAppend } from '../shared-utils';
import { StorageKey } from '../../consts';

// Minimal mock of chrome.storage.local
const storage: Record<string, any> = {};

(global as any).chrome = {
  storage: {
    local: {
      get: jest.fn(async (keys: any) => {
        if (Array.isArray(keys)) {
          const res: Record<string, any> = {};
          for (const k of keys) res[k] = storage[k];
          return res;
        }
        return { [keys]: storage[keys] };
      }),
      set: jest.fn(async (items: Record<string, any>) => {
        Object.assign(storage, items);
      }),
      clear: jest.fn(async () => {
        for (const k of Object.keys(storage)) delete storage[k];
      }),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
};

describe('shared-utils storage limits', () => {
  beforeEach(() => {
    for (const k of Object.keys(storage)) delete storage[k];
    jest.clearAllMocks();
  });

  test('simpleSet trims arrays for capped keys', async () => {
    const many = Array.from({ length: 600 }, (_, i) => i);
    await simpleSet<number[]>(StorageKey.HISTORY as any, many as any);
    const res = await simpleGet<number[]>(StorageKey.HISTORY as any, []);
    // HISTORY cap in code is 500
    expect(res.length).toBeLessThanOrEqual(500);
    expect(res[0]).toBe(600 - 500);
    expect(res[res.length - 1]).toBe(599);
  });

  test('simplePrepend enforces maxLength param', async () => {
    // Prepopulate with some data
    await simpleSet<number[]>(StorageKey.LOG as any, [1,2,3]);
    await simplePrepend<number>(StorageKey.LOG as any, 99, 2);
    const res = await simpleGet<number[]>(StorageKey.LOG as any, []);
    // After prepend with maxLength 2, only [99,1]
    expect(res.length).toBe(2);
    expect(res[0]).toBe(99);
  });

  test('simpleAppend enforces maxLength param', async () => {
    await simpleSet<number[]>(StorageKey.LOG as any, [1,2,3]);
    await simpleAppend<number>(StorageKey.LOG as any, 100, 2);
    const res = await simpleGet<number[]>(StorageKey.LOG as any, []);
    // After append with maxLength 2, should be [3,100]
    expect(res.length).toBe(2);
    expect(res[0]).toBe(3);
    expect(res[1]).toBe(100);
  });

  test('exportAllData returns a Blob containing JSON of all keys', async () => {
    // Prepopulate some keys
    (global as any).__TEST_EXPORT = {};
    (global as any).chrome.storage.local.get = jest.fn(async (keys: any) => {
      const out: Record<string, any> = {};
      for (const k of keys) out[k] = ['a', 'b'];
      return out;
    });
    const { exportAllData } = await import('../shared-utils');
    const blob = await exportAllData();
    expect(blob).toBeDefined();
    expect(blob.type).toBe('application/json');
    // When Blob.text/arrayBuffer are unavailable, at minimum the blob should have a non-zero size
    if (typeof (blob as any).size === 'number') {
      expect((blob as any).size).toBeGreaterThan(0);
    }
  });

  test('contextData returns uuid and timestamp', () => {
    const { contextData } = require('../shared-utils');
    const d = contextData();
    expect(typeof d.uuid).toBe('string');
    expect(typeof d.timestamp).toBe('string');
  });
});
